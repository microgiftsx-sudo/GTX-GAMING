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
};
