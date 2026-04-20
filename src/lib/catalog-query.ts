import { unstable_cache } from 'next/cache';
import { iqdToEur } from '@/lib/currency';
import type { StoreProduct } from '@/lib/store-product';
import { applyVatToStoreProduct } from '@/lib/store-product-vat';
import { getBaghdadDayKey } from '@/lib/daily-cache-key';
import { searchCatalogUncached } from '@/lib/catalog/facade';
import { getCatalogProvider } from '@/lib/catalog-provider';
import { CATALOG_LISTING_CACHE_TAG } from '@/lib/catalog-cache-tags';
import type { CachedProductsArgs } from '@/lib/catalog-search-args';
import { sortCatalogItems } from '@/lib/catalog-search-rank';

export type { CachedProductsArgs } from '@/lib/catalog-search-args';

export async function fetchProductsUncached(args: CachedProductsArgs) {
  const { taxRate } = args;

  const iqdToKinguinBase = (iqd: number) =>
    taxRate > 0 ? iqd / (1 + taxRate / 100) : iqd;

  const maxPrice =
    args.maxPriceRaw != null && args.maxPriceRaw !== '' ? Number(args.maxPriceRaw) : Infinity;

  const minEur = args.minPrice > 0 ? iqdToEur(iqdToKinguinBase(args.minPrice)) : undefined;
  const maxEur =
    Number.isFinite(maxPrice) && maxPrice < Number.MAX_SAFE_INTEGER / 4
      ? iqdToEur(iqdToKinguinBase(maxPrice))
      : undefined;

  const enriched: CachedProductsArgs = {
    ...args,
    priceFromEur: minEur,
    priceToEur: maxEur,
  };

  const raw = await searchCatalogUncached(enriched);

  let items = raw.items.map((p) => applyVatToStoreProduct(p, taxRate));

  items = sortCatalogItems(items, args.sort, args.q);

  const total = raw.total ?? items.length;

  return {
    items,
    total,
    page: raw.page,
    limit: raw.limit,
  };
}

/** Deterministic order for the same API payload (avoids unstable tie order). */
export function stabilizeCatalogOrder(items: StoreProduct[]): StoreProduct[] {
  return [...items].sort((a, b) => b.kinguinId - a.kinguinId);
}

export async function getCachedProductListing(args: CachedProductsArgs) {
  const dayKey = getBaghdadDayKey();
  const catKey = [...args.category].sort().join('|');
  const platKey = [...args.platform].sort().join('|');
  const provider = await getCatalogProvider();

  return unstable_cache(
    async () => fetchProductsUncached(args),
    [
      CATALOG_LISTING_CACHE_TAG,
      provider,
      dayKey,
      String(args.taxRate),
      String(args.page),
      String(args.limit),
      args.sort,
      args.q,
      catKey,
      platKey,
      String(args.minPrice),
      args.maxPriceRaw === null ? '' : String(args.maxPriceRaw),
    ],
    { revalidate: 86400, tags: [CATALOG_LISTING_CACHE_TAG] },
  )();
}
