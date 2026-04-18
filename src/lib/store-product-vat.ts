import { applyTaxToBaseIqd } from '@/lib/tax-math';
import type { StoreProduct } from '@/lib/store-product';

/** Apply VAT to catalog IQD prices (Kinguin base → storefront gross). */
export function applyVatToStoreProduct(p: StoreProduct, ratePercent: number): StoreProduct {
  if (ratePercent <= 0) return p;
  return {
    ...p,
    price: applyTaxToBaseIqd(p.price, ratePercent),
    originalPrice: applyTaxToBaseIqd(p.originalPrice, ratePercent),
  };
}
