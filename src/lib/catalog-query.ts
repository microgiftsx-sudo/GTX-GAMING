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

const SEARCH_MATCH_CACHE_BUMP = 'compact-query-fallback-v5';

function compactSearchText(v: string): string {
  return v
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function tokenizedSearchText(v: string): string[] {
  return v
    .normalize('NFC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/gu)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isSubsequence(needle: string, haystack: string): boolean {
  if (!needle) return false;
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i += 1;
  }
  return i === needle.length;
}

function titleMatchesLooseQuery(title: string, rawQuery: string): boolean {
  const normalizedQuery = rawQuery.normalize('NFC').trim();
  const compactTitle = compactSearchText(title);
  const compactQuery = compactSearchText(normalizedQuery);
  if (!compactTitle || !compactQuery) return false;
  if (compactTitle.includes(compactQuery)) return true;

  const queryTokens = tokenizedSearchText(normalizedQuery);
  if (queryTokens.length >= 2) {
    let from = 0;
    for (const tok of queryTokens) {
      const idx = compactTitle.indexOf(tok, from);
      if (idx < 0) return false;
      from = idx + tok.length;
    }
    return true;
  }

  // For compact one-word queries like "rustaccount", allow title token subsequences
  // ("rust" + "account") even when extra words are between them.
  if (!/\s/u.test(normalizedQuery)) {
    if (compactQuery.length >= 6 && isSubsequence(compactQuery, compactTitle)) {
      return true;
    }
    const titleTokens = tokenizedSearchText(title);
    const maxWindow = Math.min(titleTokens.length, 6);
    for (let i = 0; i < maxWindow; i++) {
      let joined = '';
      for (let j = i; j < maxWindow; j++) {
        joined += titleTokens[j] ?? '';
        if (joined === compactQuery) return true;
        if (joined.length > compactQuery.length) break;
      }
    }
  }

  return false;
}

function shouldTryCompactFallback(rawQuery: string): boolean {
  const q = rawQuery.normalize('NFC').trim();
  if (q.length < 4) return false;
  return compactSearchText(q).length >= 4;
}

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

  let raw = await searchCatalogUncached(enriched);
  const rawQuery = listingArgs.q.normalize('NFC').trim();
  const compactQuery = compactSearchText(rawQuery);
  if (raw.items.length === 0 && compactQuery && shouldTryCompactFallback(rawQuery)) {
    const isMultiWordQuery = /\s/u.test(rawQuery);
    const firstToken = tokenizedSearchText(rawQuery)[0] ?? '';
    const fallbackQueries = isMultiWordQuery
      ? [compactQuery, firstToken, compactQuery.slice(0, 4)]
      : [rawQuery.slice(0, 4)];
    const fallbackLimit = isMultiWordQuery
      ? Math.min(100, Math.max(enriched.limit * 3, 60))
      : enriched.limit;

    for (const fq of fallbackQueries) {
      if (!fq) continue;
      const fallbackRaw = await searchCatalogUncached({
        ...enriched,
        q: fq,
        limit: fallbackLimit,
      });
      if (fallbackRaw.items.length === 0) continue;
      const filteredItems = fallbackRaw.items.filter((p) =>
        titleMatchesLooseQuery(p.title, rawQuery),
      );
      if (filteredItems.length === 0) continue;
      raw = {
        ...fallbackRaw,
        items: filteredItems,
      };
      break;
    }
  }

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
      SEARCH_MATCH_CACHE_BUMP,
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
