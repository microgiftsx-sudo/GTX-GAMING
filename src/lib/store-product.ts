import { eurToIqd } from '@/lib/currency';
import type { KinguinProductJson } from '@/lib/kinguin/types';
import { mapKinguinJson } from '@/lib/kinguin/mapProduct';

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&w=600&q=60';

export type StoreProduct = {
  id: string;
  kinguinId: number;
  title: string;
  price: number;
  originalPrice: number;
  discount: string;
  category: 'games' | 'cards' | 'software' | 'dlc';
  platform: 'steam' | 'psn' | 'xbox' | 'pc';
  region: 'global' | 'iq' | 'us' | 'eu';
  image: string;
  description: string | null;
};

export type ProductOptionChoice = {
  valueId: number;
  label: string;
};

export type ProductOptionGroup = {
  optionId: number;
  label: string;
  type: 'radio' | 'select';
  required: boolean;
  choices: ProductOptionChoice[];
};

export type KinguinPriceVariant = {
  id: string;
  label: string;
  /** EUR list price (same basis as Kinguin `price` on the product). */
  priceEur: number;
};

/** From `GET /api/products/[id]` — includes Kinguin gallery + YouTube ids. */
export type StoreProductDetail = StoreProduct & {
  galleryUrls: string[];
  youtubeIds: string[];
  catalogSource?: 'kinguin' | 'plati';
  /** Digiseller: radio/select groups with 2+ choices (shown on product page). */
  platiOptionGroups?: ProductOptionGroup[];
  /** Digiseller: merged selections for price/calc (every option row). */
  platiSelections?: { optionId: number; valueId: number }[];
  /** Digiseller `collection` — used to decide when price/calc is reliable. */
  platiCollection?: string;
  /** Kinguin: distinct offer prices when the API exposes multiple offers. */
  kinguinPriceVariants?: KinguinPriceVariant[];
};

function discountLabel(priceEur: number, originalEur: number | null | undefined): string {
  if (originalEur == null || originalEur <= priceEur) return '—';
  const pct = Math.round((1 - priceEur / originalEur) * 100);
  return pct > 0 ? `-${pct}%` : '—';
}

/** Show purple discount badge only when Kinguin reports a real markdown (not placeholder "—"). */
export function discountBadgeVisible(discount: string): boolean {
  const s = discount.trim();
  if (!s || s === '—' || s === '-') return false;
  return /^-\d+%$/.test(s);
}

/** Map live Kinguin API JSON to storefront shape (same rules as DB row). */
export function fromKinguinJson(p: KinguinProductJson): StoreProduct {
  const m = mapKinguinJson(p);
  const price = Math.round(eurToIqd(m.priceEur));
  const originalEur = m.originalPriceEur;
  const original =
    originalEur != null && originalEur > m.priceEur
      ? Math.round(eurToIqd(originalEur))
      : price;

  return {
    id: String(m.kinguinId),
    kinguinId: m.kinguinId,
    title: m.name,
    price,
    originalPrice: original,
    discount: discountLabel(m.priceEur, originalEur),
    category: m.categorySlug as StoreProduct['category'],
    platform: m.platformSlug as StoreProduct['platform'],
    region: 'global',
    image: m.imageUrl ?? PLACEHOLDER_IMAGE,
    description: m.description,
  };
}
