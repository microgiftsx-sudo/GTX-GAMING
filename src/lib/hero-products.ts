import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getDataRoot } from '@/lib/data-root';
import { revalidateTag } from 'next/cache';
import { getCatalogProductDetailUncached, searchCatalogUncached } from '@/lib/catalog/facade';
import type { StoreProduct } from '@/lib/store-product';
import { applyVatToStoreProduct } from '@/lib/store-product-vat';
import { getTaxRatePercent } from '@/lib/tax';

const FILE = path.join(getDataRoot(), 'hero-products.json');

/** Next.js Data Cache tag — call `revalidateHeroCarousel` after bot/file edits */
export const HERO_CAROUSEL_CACHE_TAG = 'hero-carousel';

/** Matches hero carousel capacity */
export const HERO_CAROUSEL_MAX = 6;

/** Default: 24h — how long hero API response stays cached before revalidation */
export const DEFAULT_HERO_CACHE_TTL_SECONDS = 86400;

const MIN_HERO_CACHE_TTL = 60;
const MAX_HERO_CACHE_TTL = 86400 * 7;

type HeroSettings = {
  ids: string[];
  cacheTtlSeconds?: number;
};

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

export function normalizeHeroCacheTtlSeconds(raw: number | undefined | null): number {
  if (raw == null || !Number.isFinite(raw)) return DEFAULT_HERO_CACHE_TTL_SECONDS;
  return Math.min(MAX_HERO_CACHE_TTL, Math.max(MIN_HERO_CACHE_TTL, Math.floor(raw)));
}

async function readSettings(): Promise<HeroSettings> {
  try {
    const raw = await readFile(FILE, 'utf8');
    const data = JSON.parse(raw) as HeroSettings;
    if (!Array.isArray(data.ids)) return { ids: [] };
    return {
      ids: uniqueKinguinIds(data.ids.map(String)),
      cacheTtlSeconds: normalizeHeroCacheTtlSeconds(data.cacheTtlSeconds),
    };
  } catch {
    return { ids: [] };
  }
}

async function writeSettings(settings: HeroSettings): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  const ttl = normalizeHeroCacheTtlSeconds(settings.cacheTtlSeconds);
  await writeFile(
    FILE,
    `${JSON.stringify({ ids: settings.ids, cacheTtlSeconds: ttl }, null, 2)}\n`,
    'utf8',
  );
}

/** Invalidate cached hero JSON so the next request refetches Kinguin */
/** Next 16+: second arg required; `{ expire: 0 }` expires tagged cache so the next /api/products/hero hit refetches. */
export function revalidateHeroCarousel(): void {
  try {
    revalidateTag(HERO_CAROUSEL_CACHE_TAG, { expire: 0 });
  } catch {
    /* revalidateTag may throw outside request context — ignore */
  }
}

/** Product IDs configured for the home hero (empty = use catalog default). */
export async function getHeroProductIds(): Promise<string[]> {
  const s = await readSettings();
  return s.ids;
}

export async function getHeroCacheTtlSeconds(): Promise<number> {
  const s = await readSettings();
  return normalizeHeroCacheTtlSeconds(s.cacheTtlSeconds);
}

/** Replace hero IDs; invalid entries are skipped. Returns the saved list. */
export async function setHeroProductIds(ids: string[]): Promise<string[]> {
  const s = await readSettings();
  const next = uniqueKinguinIds(ids);
  await writeSettings({ ids: next, cacheTtlSeconds: s.cacheTtlSeconds });
  revalidateHeroCarousel();
  return next;
}

/** How long the hero carousel response is cached (seconds). Default 24h. */
export async function setHeroCacheTtlSeconds(seconds: number): Promise<number> {
  const s = await readSettings();
  const ttl = normalizeHeroCacheTtlSeconds(seconds);
  await writeSettings({ ids: s.ids, cacheTtlSeconds: ttl });
  revalidateHeroCarousel();
  return ttl;
}

/**
 * Products for the hero: explicit IDs when set, otherwise first page of catalog (same as before).
 */
export async function getHeroStoreProducts(): Promise<StoreProduct[]> {
  const taxRate = await getTaxRatePercent();
  const ids = await getHeroProductIds();
  if (ids.length === 0) {
    const raw = await searchCatalogUncached({
      page: 1,
      limit: HERO_CAROUSEL_MAX,
      q: '',
      category: [],
      platform: [],
      minPrice: 0,
      maxPriceRaw: null,
      sort: 'relevance',
      taxRate,
    });
    return raw.items.map((p) => applyVatToStoreProduct(p, taxRate));
  }

  const items: StoreProduct[] = [];
  for (const id of ids) {
    const kid = Number.parseInt(id, 10);
    if (!Number.isFinite(kid)) continue;
    try {
      const detail = await getCatalogProductDetailUncached(kid);
      items.push(
        applyVatToStoreProduct(
          {
            id: detail.id,
            kinguinId: detail.kinguinId,
            title: detail.title,
            price: detail.price,
            originalPrice: detail.originalPrice,
            discount: detail.discount,
            category: detail.category,
            platform: detail.platform,
            region: detail.region,
            image: detail.image,
            description: detail.description,
          },
          taxRate,
        ),
      );
    } catch {
      /* omit missing or API errors */
    }
  }
  return items;
}
