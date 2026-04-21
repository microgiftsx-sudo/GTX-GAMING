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
import { resolveCatalogSearchQuery } from '@/lib/search-query-translate';
import { fetchGoogleDidYouMeanCandidates } from '@/lib/google-cse-spelling';
import {
  ACCOUNTS_LISTING_CACHE_BUMP,
  filterStoreProductsToAccountListings,
  normalizeListingArgsForCatalog,
} from '@/lib/accounts-listing';

export type { CachedProductsArgs } from '@/lib/catalog-search-args';

export type ProductListingPayload = {
  items: StoreProduct[];
  total: number;
  page: number;
  limit: number;
  /** Shown only if this exact wording yields catalog hits (same filters as the empty search). */
  didYouMean?: string;
  /**
   * Raw number of products returned for this page before optional `accounts` text filter.
   * Used by the search UI for “load more” when many rows were dropped client-side.
   */
  listingBatchSize?: number;
};

function buildEnrichedCatalogArgs(
  args: CachedProductsArgs,
  qResolved: string,
): CachedProductsArgs {
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

  return {
    ...args,
    q: qResolved,
    priceFromEur: minEur,
    priceToEur: maxEur,
  };
}

/** True if the store returns at least one hit for this user-facing query (respects category/platform/price). */
async function catalogHasHitsForAlternateQuery(
  args: CachedProductsArgs,
  rawCandidateQ: string,
): Promise<boolean> {
  const base = normalizeListingArgsForCatalog({ ...args, q: rawCandidateQ });
  const qResolved = await resolveCatalogSearchQuery(base.q);
  if (!qResolved.trim()) return false;

  const enriched = buildEnrichedCatalogArgs(base, qResolved);
  const probeLimit = args.category.includes('accounts') ? 15 : 1;
  const probe = await searchCatalogUncached({
    ...enriched,
    page: 1,
    limit: probeLimit,
  });
  let rows = probe.items.map((p) => applyVatToStoreProduct(p, base.taxRate));
  if (args.category.includes('accounts')) {
    rows = filterStoreProductsToAccountListings(rows);
  }
  return rows.length > 0;
}

/** Catalog listing only (VAT, translate, sort). Cached — do not call Google here. */
async function fetchProductsListingCore(args: CachedProductsArgs) {
  const { taxRate } = args;

  const listingArgs = normalizeListingArgsForCatalog(args);
  const qForCatalog = await resolveCatalogSearchQuery(listingArgs.q);
  const enriched = buildEnrichedCatalogArgs(listingArgs, qForCatalog);

  const raw = await searchCatalogUncached(enriched);

  const rawBatchLen = raw.items.length;
  const accountsBrowse = args.category.includes('accounts');

  let items = raw.items.map((p) => applyVatToStoreProduct(p, taxRate));
  if (accountsBrowse) {
    items = filterStoreProductsToAccountListings(items);
  }

  items = sortCatalogItems(items, args.sort, qForCatalog);

  const total = raw.total ?? items.length;

  return {
    items,
    total,
    page: raw.page,
    limit: raw.limit,
    ...(accountsBrowse ? { listingBatchSize: rawBatchLen } : {}),
  };
}

/** Deterministic order for the same API payload (avoids unstable tie order). */
export function stabilizeCatalogOrder(items: StoreProduct[]): StoreProduct[] {
  return [...items].sort((a, b) => b.kinguinId - a.kinguinId);
}

export async function getCachedProductListing(args: CachedProductsArgs) {
  const dayKey = getBaghdadDayKey();
  const norm = normalizeListingArgsForCatalog(args);
  const catKey = [...norm.category].sort().join('|');
  const platKey = [...norm.platform].sort().join('|');
  const provider = await getCatalogProvider();

  const core = await unstable_cache(
    async () => fetchProductsListingCore(args),
    [
      CATALOG_LISTING_CACHE_TAG,
      provider,
      dayKey,
      String(args.taxRate),
      String(args.page),
      String(args.limit),
      args.sort,
      norm.q,
      catKey,
      platKey,
      String(args.minPrice),
      args.maxPriceRaw === null ? '' : String(args.maxPriceRaw),
      args.category.includes('accounts') ? ACCOUNTS_LISTING_CACHE_BUMP : '',
    ],
    { revalidate: 86400, tags: [CATALOG_LISTING_CACHE_TAG] },
  )();

  let didYouMean: string | undefined;
  if (args.page === 1 && core.total === 0 && args.q.trim().length >= 2) {
    const listingArgs = normalizeListingArgsForCatalog(args);
    const qForCatalog = await resolveCatalogSearchQuery(listingArgs.q);
    const candidates = await fetchGoogleDidYouMeanCandidates(args.q, [qForCatalog]);
    const userQ = args.q.normalize('NFC').trim();
    const eligible = candidates
      .map((c) => c.normalize('NFC').trim())
      .filter((t) => t && t.toLowerCase() !== userQ.toLowerCase());
    for (const c of eligible) {
      if (await catalogHasHitsForAlternateQuery(args, c)) {
        didYouMean = c;
        break;
      }
    }
  }

  return {
    ...core,
    ...(didYouMean ? { didYouMean } : {}),
  };
}
