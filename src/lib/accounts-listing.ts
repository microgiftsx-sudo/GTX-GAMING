import type { CachedProductsArgs } from '@/lib/catalog-search-args';
import { normalizeListingPlatforms } from '@/lib/catalog-search-args';
import type { StoreProduct } from '@/lib/store-product';

/**
 * Default Plati/Kinguin search seed for the virtual `accounts` storefront section.
 * `game account` was too narrow on Plati (very few global hits); `account` is broader
 * while the storefront still filters to real account listings via `isLikelyGameAccountProduct`.
 */
export const ACCOUNTS_CATALOG_DEFAULT_QUERY = 'account';

/** Bump when account matching rules or default query change (invalidates `unstable_cache` rows). */
export const ACCOUNTS_LISTING_CACHE_BUMP = 'title-only-v4-plati-fetch';

/** Virtual filter: not a `StoreProduct.category` — stripped before provider filters. */
export function normalizeListingArgsForCatalog(args: CachedProductsArgs): CachedProductsArgs {
  const platform = normalizeListingPlatforms(args.platform);

  if (!args.category.includes('accounts')) {
    const { accountsBrowse: _a, ...rest } = args;
    return { ...rest, platform };
  }

  const category = args.category.filter((c) => c !== 'accounts');
  const q = args.q.trim().length > 0 ? args.q : ACCOUNTS_CATALOG_DEFAULT_QUERY;
  return { ...args, platform, category, q, accountsBrowse: true };
}

/**
 * Heuristic: product title reads like a sold **account** listing.
 * We intentionally ignore long descriptions — Plati/Kinguin boilerplate often mentions
 * “Steam account”, “activate on your account”, etc., which caused false positives.
 */
export function isLikelyGameAccountProduct(
  title: string,
  _description: string | null | undefined,
): boolean {
  const t = title.normalize('NFC').trim();
  const titleL = t.toLowerCase();

  const titleCue =
    /\baccounts?\b/i.test(titleL) ||
    /\bacc\b/i.test(titleL) ||
    /حساب/.test(t) ||
    /аккаунт|логин/i.test(titleL) ||
    /\b(full|complete)\s+access\b/i.test(titleL) ||
    /\bkomplettes?\s+konto\b/i.test(titleL) ||
    /\blog\s*in\b/i.test(titleL);

  if (!titleCue) return false;

  const giftish =
    /\b(gift\s*card|giftcard|e-?gift|wallet\s*(top|code)?|top-?up|digital\s*code|pin\s*code|voucher|\bcd\s*key\b|steam\s*key\b|pc\s*steam\s*cd\s*key)\b/i.test(
      titleL,
    );
  if (
    giftish &&
    !/\b(game|steam|full|epic|pc)\s*account\b|\baccount(s)?\s*(with|for)\b/i.test(titleL)
  ) {
    return false;
  }

  return true;
}

export function filterStoreProductsToAccountListings(items: StoreProduct[]): StoreProduct[] {
  return items.filter((p) => isLikelyGameAccountProduct(p.title, p.description));
}
