import type { KinguinProductJson } from '@/lib/kinguin/types';
import type { KinguinPriceVariant } from '@/lib/store-product';

/**
 * We intentionally do not surface Kinguin `offers[]` (merchant-specific) in the storefront —
 * only the catalog list price is used.
 */
export function kinguinPriceVariantsFromJson(_p: KinguinProductJson): KinguinPriceVariant[] | undefined {
  return undefined;
}
