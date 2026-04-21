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
  /** Kinguin EUR filter — computed in `catalog-query` from IQD bounds + VAT. */
  priceFromEur?: number;
  priceToEur?: number;
  /**
   * Set by `normalizeListingArgsForCatalog` when the URL had `accounts` in `category`.
   * Used to widen Plati fetch before the title-only account heuristic drops rows.
   */
  accountsBrowse?: boolean;
};

const STORE_PLATFORM_SLUGS = ['steam', 'psn', 'xbox', 'pc'] as const;

/** When every storefront platform bucket is selected, treat as “no platform restriction”. */
export function normalizeListingPlatforms(platform: string[]): string[] {
  const set = new Set(platform.map((p) => p.trim().toLowerCase()).filter(Boolean));
  const hasAll = STORE_PLATFORM_SLUGS.every((s) => set.has(s));
  if (hasAll) return [];
  return [...set];
}
