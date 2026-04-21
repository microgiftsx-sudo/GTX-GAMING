import { fetchProductByKinguinId, fetchProductsPage } from '@/lib/kinguin/client';
import { fromKinguinJson } from '@/lib/store-product';
import type { StoreProduct, StoreProductDetail } from '@/lib/store-product';
import { getCatalogProvider } from '@/lib/catalog-provider';
import { fetchDigisellerProductData, fetchPlatiSearchPage } from '@/lib/plati/client';
import {
  storeProductFromPlatiSearchItem,
  storeProductDetailFromDigisellerJson,
} from '@/lib/plati/mapStoreProduct';
import { extractGalleryUrls, extractYoutubeIds } from '@/lib/kinguin/media';
import { kinguinPriceVariantsFromJson } from '@/lib/kinguin/priceVariants';
import type { CachedProductsArgs } from '@/lib/catalog-search-args';
import { netFromGrossIqd } from '@/lib/tax';

/** Fallback Plati search term when user query is shorter than 3 characters. */
const PLATI_DEFAULT_QUERY = 'steam';

function platiSearchQuery(userQuery: string): string {
  const q = userQuery.trim();
  if (q.length >= 3) return q;
  return PLATI_DEFAULT_QUERY;
}

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

function platiBasePriceBounds(args: CachedProductsArgs): { minBase?: number; maxBase?: number } {
  const tax = args.taxRate;
  let minBase: number | undefined;
  if (args.minPrice > 0) {
    minBase = tax > 0 ? netFromGrossIqd(args.minPrice, tax) : args.minPrice;
  }
  const maxRaw =
    args.maxPriceRaw != null && args.maxPriceRaw !== '' ? Number(args.maxPriceRaw) : Infinity;
  let maxBase: number | undefined;
  if (Number.isFinite(maxRaw) && maxRaw < Number.MAX_SAFE_INTEGER / 4) {
    maxBase = tax > 0 ? netFromGrossIqd(maxRaw, tax) : maxRaw;
  }
  return { minBase, maxBase };
}

function applyPlatiFilters(items: StoreProduct[], args: CachedProductsArgs): StoreProduct[] {
  let out = items;
  const { minBase, maxBase } = platiBasePriceBounds(args);

  if (args.category.length > 0) {
    const set = new Set(args.category);
    out = out.filter((p) => set.has(p.category));
  }
  if (args.platform.length > 0) {
    const set = new Set(args.platform.map((x) => x.toLowerCase()));
    out = out.filter((p) => set.has(p.platform));
  }
  if (minBase != null && minBase > 0) {
    out = out.filter((p) => p.price >= minBase);
  }
  if (maxBase != null) {
    out = out.filter((p) => p.price <= maxBase);
  }

  return out;
}

export async function searchCatalogUncached(
  args: CachedProductsArgs,
): Promise<{ items: StoreProduct[]; total: number; page: number; limit: number }> {
  const provider = await getCatalogProvider();
  if (provider === 'kinguin') {
    const tags = categoriesToTags(args.category);
    const platformParam =
      args.platform.length > 0 ? args.platform.map((p) => p.toLowerCase()).join(',') : undefined;

    const data = await fetchProductsPage({
      page: args.page,
      limit: args.limit,
      sortBy: 'updatedAt',
      sortType: 'desc',
      name: args.q.length >= 3 ? args.q : undefined,
      platform: platformParam,
      tags,
      priceFrom: args.priceFromEur,
      priceTo: args.priceToEur,
    });

    const items = (data.results ?? []).map(fromKinguinJson);
    const total = data.item_count ?? items.length;
    return { items, total, page: args.page, limit: args.limit };
  }

  const query = platiSearchQuery(args.q);
  const raw = await fetchPlatiSearchPage({
    query,
    page: args.page,
    pageSize: args.limit,
  });

  const items = applyPlatiFilters((raw.items ?? []).map(storeProductFromPlatiSearchItem), args);
  const total = typeof raw.total === 'number' ? raw.total : items.length;
  return { items, total, page: args.page, limit: args.limit };
}

export async function getCatalogProductDetailUncached(
  id: number,
): Promise<StoreProductDetail> {
  const provider = await getCatalogProvider();
  if (provider === 'kinguin') {
    const json = await fetchProductByKinguinId(id);
    const base = fromKinguinJson(json);
    const g = extractGalleryUrls(json);
    const variants = kinguinPriceVariantsFromJson(json);
    return {
      ...base,
      galleryUrls: g.length > 0 ? g : [base.image],
      youtubeIds: extractYoutubeIds(json),
      catalogSource: 'kinguin',
      kinguinPriceVariants: variants,
    };
  }

  const data = await fetchDigisellerProductData(id);
  if (data.retval !== 0 || !data.product || typeof data.product !== 'object') {
    throw new Error(`Digiseller product ${id}: retval=${data.retval} ${data.retdesc ?? ''}`);
  }
  return storeProductDetailFromDigisellerJson(data.product as Record<string, unknown>);
}

export function storefrontProductUrl(
  provider: Awaited<ReturnType<typeof getCatalogProvider>>,
  productId: string,
): string {
  if (provider === 'plati') {
    return `https://plati.market/itm/${encodeURIComponent(productId)}`;
  }
  return `https://www.kinguin.net/product/${encodeURIComponent(productId)}`;
}
