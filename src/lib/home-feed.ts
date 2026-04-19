import { unstable_cache } from 'next/cache';
import {
  getHeroProductIds,
  getHeroStoreProducts,
  getHeroCacheTtlSeconds,
  HERO_CAROUSEL_CACHE_TAG,
} from '@/lib/hero-products';
import { getTaxRatePercent } from '@/lib/tax';
import type { StoreProduct } from '@/lib/store-product';
import {
  getCachedProductListing,
  stabilizeCatalogOrder,
  type CachedProductsArgs,
} from '@/lib/catalog-query';

function stabilizeHeroOrder(ids: string[], items: StoreProduct[]): StoreProduct[] {
  if (ids.length > 0) {
    return items;
  }
  return stabilizeCatalogOrder(items);
}

/** Same payload as GET /api/products/hero — single source for route + home SSR. */
export async function getCachedHeroHomeItems(): Promise<StoreProduct[]> {
  const ids = await getHeroProductIds();
  const idsKey = ids.length ? ids.join(',') : 'catalog';
  const taxRate = await getTaxRatePercent();
  const ttl = await getHeroCacheTtlSeconds();

  return unstable_cache(
    async () => {
      const configuredIds = await getHeroProductIds();
      const raw = await getHeroStoreProducts();
      return stabilizeHeroOrder(configuredIds, raw);
    },
    ['hero-store-products-v3', idsKey, String(taxRate)],
    { revalidate: ttl, tags: [HERO_CAROUSEL_CACHE_TAG] },
  )();
}

const TRENDING_LIMIT = 10;

/** Home “trending” strip — same cache key as /api/products?page=1&limit=10&sort=relevance. */
export async function getCachedHomeTrendingItems(): Promise<StoreProduct[]> {
  const taxRate = await getTaxRatePercent();
  const args: CachedProductsArgs = {
    page: 1,
    limit: TRENDING_LIMIT,
    q: '',
    category: [],
    platform: [],
    minPrice: 0,
    maxPriceRaw: null,
    sort: 'relevance',
    taxRate,
  };
  const payload = await getCachedProductListing(args);
  return stabilizeCatalogOrder(payload.items);
}
