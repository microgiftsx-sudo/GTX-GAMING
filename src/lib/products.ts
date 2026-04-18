/**
 * Legacy static product shape. The live catalog comes from the Kinguin API
 * via `/api/products` and `StoreProduct` in `store-product.ts`.
 */
export interface Product {
  id: string;
  key: string;
  price: number;
  originalPrice: number;
  discount: string;
  category: 'games' | 'cards' | 'software' | 'dlc';
  platform: 'steam' | 'psn' | 'xbox' | 'pc';
  region: 'global' | 'iq' | 'us' | 'eu';
  image: string;
}

/** Kept empty; use Kinguin-backed API for listings. */
export const ALL_PRODUCTS: Product[] = [];
