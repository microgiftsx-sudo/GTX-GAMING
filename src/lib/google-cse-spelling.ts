/**
 * Google hints for "Did you mean?" (CSE spelling + Chrome suggest).
 * Arabic suggest bodies use Windows-1256 inside JSON — see fetchGoogleSuggestStrings.
 *
 * Callers should filter candidates against the real catalog (e.g. `catalog-query`).
 *
 * Env: `GOOGLE_CUSTOM_SEARCH_API_KEY`, `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` (cx).
 * @see https://developers.google.com/custom-search/v1/overview
 */

import { hasArabicScript } from '@/lib/search-query-translate';

const CSE_URL = 'https://www.googleapis.com/customsearch/v1';
const SUGGEST_URL = 'https://suggestqueries.google.com/complete/search';

/** Cap Google suggest strings per request — keeps downstream catalog probes small. */
const MAX_SUGGEST_PER_CALL = 5;
/** Max alternate queries passed to catalog validation (rate-limit friendly). */
const MAX_CANDIDATES_TOTAL = 8;

function equivalentQueries(a: string, b: string): boolean {
  const na = a.normalize('NFC').trim();
  const nb = b.normalize('NFC').trim();
  if (na === nb) return true;
  if (na.toLowerCase() === nb.toLowerCase()) return true;
  return false;
}

type CseListResponse = {
  spelling?: { correctedQuery?: string };
};

export async function fetchGoogleCseSpellingSuggestion(
  rawQuery: string,
  alreadyTriedQueries: string[],
): Promise<string | null> {
  const q = rawQuery.normalize('NFC').trim();
  if (q.length < 2) return null;

  const key = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY?.trim();
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID?.trim();
  if (!key || !cx) return null;

  const url = new URL(CSE_URL);
  url.searchParams.set('key', key);
  url.searchParams.set('cx', cx);
  url.searchParams.set('q', q);
  url.searchParams.set('num', '1');

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  let body: CseListResponse;
  try {
    body = (await res.json()) as CseListResponse;
  } catch {
    return null;
  }

  const corrected = body.spelling?.correctedQuery?.normalize('NFC').trim();
  if (!corrected) return null;

  if (equivalentQueries(corrected, q)) return null;
  for (const prev of alreadyTriedQueries) {
    if (prev && equivalentQueries(corrected, prev)) return null;
  }

  return corrected;
}

async function fetchGoogleSuggestStrings(q: string, hl: 'ar' | 'en'): Promise<string[]> {
  const trimmed = q.normalize('NFC').trim();
  if (trimmed.length < 2) return [];

  const url = new URL(SUGGEST_URL);
  url.searchParams.set('client', 'chrome');
  url.searchParams.set('hl', hl);
  url.searchParams.set('q', trimmed);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json, text/javascript, */*' },
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  let data: unknown;
  try {
    const ab = await res.arrayBuffer();
    const text =
      hl === 'ar'
        ? new TextDecoder('windows-1256').decode(ab)
        : new TextDecoder('utf-8').decode(ab);
    const cleaned = text.replace(/^\)\]\}'\s*/, '');
    data = JSON.parse(cleaned) as unknown;
  } catch {
    return [];
  }

  if (!Array.isArray(data) || data.length < 2) return [];
  const list = data[1];
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    const s = String(item).normalize('NFC').trim();
    if (s) out.push(s);
  }
  return out;
}

function takeSuggestCandidates(
  strings: string[],
  queryEcho: string,
  seen: string[],
  max: number,
): string[] {
  const trimmedEcho = queryEcho.normalize('NFC').trim();
  const out: string[] = [];
  for (const s of strings) {
    if (out.length >= max) break;
    const t = s.normalize('NFC').trim();
    if (!t) continue;
    if (equivalentQueries(t, trimmedEcho)) continue;
    if (seen.some((x) => x && equivalentQueries(t, x))) continue;
    if (out.some((o) => equivalentQueries(o, t))) continue;
    out.push(t);
  }
  return out;
}

/**
 * Ordered query strings from Google (CSE spelling first, then suggest completions).
 * Not store-validated — filter with catalog search before showing to users.
 */
export async function fetchGoogleDidYouMeanCandidates(
  rawQuery: string,
  resolvedQueries: string[],
): Promise<string[]> {
  const resolved = resolvedQueries.map((s) => s?.normalize('NFC').trim()).filter(Boolean);
  const raw = rawQuery.normalize('NFC').trim();
  const seeds: string[] = [];
  if (raw) seeds.push(raw);
  for (const r of resolved) {
    if (r && !seeds.some((s) => equivalentQueries(s, r))) seeds.push(r);
  }

  const seen: string[] = [];
  for (const s of seeds) {
    const t = s.normalize('NFC').trim();
    if (t && !seen.some((x) => equivalentQueries(x, t))) seen.push(t);
  }

  const candidates: string[] = [];

  function pushIfNew(s: string) {
    const t = s.normalize('NFC').trim();
    if (!t) return;
    if (candidates.length >= MAX_CANDIDATES_TOTAL) return;
    if (candidates.some((c) => equivalentQueries(c, t))) return;
    if (seen.some((x) => x && equivalentQueries(x, t))) return;
    candidates.push(t);
    seen.push(t);
  }

  for (const seed of seeds) {
    const cse = await fetchGoogleCseSpellingSuggestion(seed, seen);
    if (cse) pushIfNew(cse);
    if (candidates.length >= MAX_CANDIDATES_TOTAL) return candidates;
  }

  const hlRaw: 'ar' | 'en' = hasArabicScript(rawQuery) ? 'ar' : 'en';
  const rawStrings = await fetchGoogleSuggestStrings(raw, hlRaw);
  for (const s of takeSuggestCandidates(rawStrings, raw, seen, MAX_SUGGEST_PER_CALL)) {
    pushIfNew(s);
    if (candidates.length >= MAX_CANDIDATES_TOTAL) return candidates;
  }

  for (const r of resolved) {
    if (!r || equivalentQueries(r, raw)) continue;
    const hl: 'ar' | 'en' = hasArabicScript(r) ? 'ar' : 'en';
    const more = await fetchGoogleSuggestStrings(r, hl);
    for (const s of takeSuggestCandidates(more, r, seen, MAX_SUGGEST_PER_CALL)) {
      pushIfNew(s);
      if (candidates.length >= MAX_CANDIDATES_TOTAL) return candidates;
    }
  }

  return candidates;
}
