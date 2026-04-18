import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchProductByKinguinId, fetchProductsPage } from '@/lib/kinguin/client';
import { fromKinguinJson } from '@/lib/store-product';
import type { StoreProduct } from '@/lib/store-product';

const FILE = path.join(process.cwd(), 'data', 'hero-products.json');

/** Matches hero carousel capacity */
export const HERO_CAROUSEL_MAX = 6;

type HeroSettings = { ids: string[] };

function uniqueKinguinIds(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw) {
    const t = String(s).trim();
    if (!t || seen.has(t)) continue;
    if (!/^\d+$/.test(t)) continue;
    const n = Number.parseInt(t, 10);
    if (!Number.isFinite(n) || n < 1) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= HERO_CAROUSEL_MAX) break;
  }
  return out;
}

async function readSettings(): Promise<HeroSettings> {
  try {
    const raw = await readFile(FILE, 'utf8');
    const data = JSON.parse(raw) as HeroSettings;
    if (!Array.isArray(data.ids)) return { ids: [] };
    return { ids: uniqueKinguinIds(data.ids.map(String)) };
  } catch {
    return { ids: [] };
  }
}

/** Kinguin product IDs configured for the home hero (empty = use catalog default). */
export async function getHeroProductIds(): Promise<string[]> {
  const s = await readSettings();
  return s.ids;
}

/** Replace hero IDs; invalid entries are skipped. Returns the saved list. */
export async function setHeroProductIds(ids: string[]): Promise<string[]> {
  const next = uniqueKinguinIds(ids);
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, `${JSON.stringify({ ids: next }, null, 2)}\n`, 'utf8');
  return next;
}

/**
 * Products for the hero: explicit IDs when set, otherwise first page of catalog (same as before).
 */
export async function getHeroStoreProducts(): Promise<StoreProduct[]> {
  const ids = await getHeroProductIds();
  if (ids.length === 0) {
    const data = await fetchProductsPage({
      page: 1,
      limit: HERO_CAROUSEL_MAX,
      sortBy: 'updatedAt',
      sortType: 'desc',
    });
    return (data.results ?? []).map(fromKinguinJson);
  }

  const items: StoreProduct[] = [];
  for (const id of ids) {
    const kid = Number.parseInt(id, 10);
    if (!Number.isFinite(kid)) continue;
    try {
      const json = await fetchProductByKinguinId(kid);
      items.push(fromKinguinJson(json));
    } catch {
      /* omit missing or API errors */
    }
  }
  return items;
}
