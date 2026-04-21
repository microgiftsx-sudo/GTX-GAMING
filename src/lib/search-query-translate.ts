import rawOverrides from '@/data/search-query-ar-overrides.json';
import { getSearchTranslateSettings } from '@/lib/search-translate-settings';

const MYMEMORY_GET = 'https://api.mymemory.translated.net/get';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 600;
const MAX_QUERY_LEN = 400;

type OverrideJson = Record<string, string>;

function buildNormalizedOverrides(src: OverrideJson): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(src)) {
    const key = normalizeKey(k);
    const val = String(v).trim();
    if (key && val) out[key] = val;
  }
  return out;
}

function normalizeKey(s: string): string {
  return s.normalize('NFC').trim().toLowerCase();
}

const OVERRIDES = buildNormalizedOverrides(rawOverrides as OverrideJson);

/** Arabic + Arabic supplement blocks used in UI search. */
const ARABIC_SCRIPT =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

function hasArabicScript(s: string): boolean {
  return ARABIC_SCRIPT.test(s);
}

/** Strip common MT clutter so Plati/Kinguin get short keyword-style English. */
function polishMachineSearchEnglish(s: string): string {
  let t = s.normalize('NFC').trim();
  t = t.replace(/[\u200B-\u200D\uFEFF]/g, '');
  t = t.replace(/^[\s"'«»""''`]+|[\s"'«»""''`]+$/g, '');
  t = t.replace(/\s+/g, ' ');
  t = t.replace(/^(the|a|an)\s+/i, '');
  t = t.replace(/[.!?،]+$/u, '');
  return t.trim();
}

type CacheEntry = { at: number; val: string };
const memCache = new Map<string, CacheEntry>();

function cacheGet(key: string): string | undefined {
  const e = memCache.get(key);
  if (!e) return undefined;
  if (Date.now() - e.at > CACHE_TTL_MS) {
    memCache.delete(key);
    return undefined;
  }
  return e.val;
}

function cacheSet(key: string, val: string) {
  if (memCache.size >= MAX_CACHE_ENTRIES) {
    const first = memCache.keys().next().value;
    if (first) memCache.delete(first);
  }
  memCache.set(key, { at: Date.now(), val });
}

async function myMemoryArToEn(text: string, myMemoryEmail: string): Promise<string | null> {
  const u = new URL(MYMEMORY_GET);
  u.searchParams.set('q', text.slice(0, MAX_QUERY_LEN));
  u.searchParams.set('langpair', 'ar|en');
  const email = myMemoryEmail.trim();
  if (email.includes('@')) u.searchParams.set('de', email);

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(u.toString(), {
      signal: ac.signal,
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      responseStatus?: number;
      responseData?: { translatedText?: string };
    };
    const status = j.responseStatus;
    if (status === 403 || status === 429 || status === 456) return null;
    const out = j.responseData?.translatedText?.trim();
    return out && out.length > 0 ? out : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Turn storefront search `q` into text Plati/Kinguin can match.
 * - Manual overrides (`search-query-ar-overrides.json`) always win.
 * - Settings: `DATA_DIR/search-translate.json` via Telegram `/searchtranslate` (enabled, mode, MyMemory email).
 * - `mode: dictionary` — no machine translator for unmatched Arabic.
 * - `mode: full` — free MyMemory `ar|en` (cached) + `polishMachineSearchEnglish`.
 */
export async function resolveCatalogSearchQuery(raw: string): Promise<string> {
  const q = raw.normalize('NFC').trim();
  if (!q) return q;
  const cfg = await getSearchTranslateSettings();
  if (!cfg.enabled) return q;

  const dictHit = OVERRIDES[normalizeKey(q)];
  if (dictHit) return dictHit;

  if (!hasArabicScript(q)) return q;

  if (cfg.mode === 'dictionary') return q;

  const cacheKey = `mm2:${normalizeKey(q)}:${cfg.myMemoryEmail}`;
  const hit = cacheGet(cacheKey);
  if (hit) return hit;

  const translated = await myMemoryArToEn(q, cfg.myMemoryEmail);
  const base = (translated && translated.length > 0 ? translated : q).trim();
  const resolved = polishMachineSearchEnglish(base);
  cacheSet(cacheKey, resolved);
  return resolved;
}
