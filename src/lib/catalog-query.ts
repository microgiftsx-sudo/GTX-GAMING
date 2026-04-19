import { unstable_cache } from 'next/cache';
import { fetchProductsPage } from '@/lib/kinguin/client';
import { iqdToEur } from '@/lib/currency';
import { fromKinguinJson } from '@/lib/store-product';
import type { StoreProduct } from '@/lib/store-product';
import { applyVatToStoreProduct } from '@/lib/store-product-vat';
import { getBaghdadDayKey } from '@/lib/daily-cache-key';

function categoriesToTags(categories: string[]): string | undefined {
  const parts: string[] = [];
  for (const c of categories) {
    if (c === 'cards') parts.push('prepaid');
    else if (c === 'software') parts.push('software');
    else if (c === 'dlc') parts.push('dlc');
  }
  if (parts.length === 0) return undefined;
  return [...new Set(parts)].join(',');
}

export type CachedProductsArgs = {
  page: number;
  limit: number;
  q: string;
  category: string[];
  platform: string[];
  minPrice: number;
  maxPriceRaw: string | null;
  sort: string;
  taxRate: number;
};

export async function fetchProductsUncached(args: CachedProductsArgs) {
  const {
    page,
    limit,
    q,
    category,
    platform,
    minPrice,
    maxPriceRaw,
    sort,
    taxRate,
  } = args;

  const maxPrice =
    maxPriceRaw != null && maxPriceRaw !== '' ? Number(maxPriceRaw) : Infinity;

  const tags = categoriesToTags(category);
  const platformParam =
    platform.length > 0 ? platform.map((p) => p.toLowerCase()).join(',') : undefined;

  const iqdToKinguinBase = (iqd: number) =>
    taxRate > 0 ? iqd / (1 + taxRate / 100) : iqd;

  const minEur = minPrice > 0 ? iqdToEur(iqdToKinguinBase(minPrice)) : undefined;
  const maxEur =
    Number.isFinite(maxPrice) && maxPrice < Number.MAX_SAFE_INTEGER / 4
      ? iqdToEur(iqdToKinguinBase(maxPrice))
      : undefined;

  const data = await fetchProductsPage({
    page,
    limit,
    sortBy: 'updatedAt',
    sortType: 'desc',
    name: q.length >= 3 ? q : undefined,
    platform: platformParam,
    tags,
    priceFrom: minEur,
    priceTo: maxEur,
  });

  let items = (data.results ?? [])
    .map(fromKinguinJson)
    .map((p) => applyVatToStoreProduct(p, taxRate));

  if (sort === 'price-low') {
    items = [...items].sort((a, b) => a.price - b.price);
  } else if (sort === 'price-high') {
    items = [...items].sort((a, b) => b.price - a.price);
  } else {
    items = stabilizeCatalogOrder(items);
  }

  const total = data.item_count ?? items.length;

  return {
    items,
    total,
    page,
    limit,
  };
}

/** Deterministic order for the same API payload (avoids unstable tie order from Kinguin). */
export function stabilizeCatalogOrder(items: StoreProduct[]): StoreProduct[] {
  return [...items].sort((a, b) => b.kinguinId - a.kinguinId);
}

export async function getCachedProductListing(args: CachedProductsArgs) {
  const dayKey = getBaghdadDayKey();
  const catKey = [...args.category].sort().join('|');
  const platKey = [...args.platform].sort().join('|');

  return unstable_cache(
    async () => fetchProductsUncached(args),
    [
      'kinguin-products-v1',
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
    { revalidate: 86400 },
  )();
}
