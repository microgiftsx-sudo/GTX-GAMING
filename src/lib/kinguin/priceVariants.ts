import type { KinguinProductJson } from '@/lib/kinguin/types';
import type { KinguinPriceVariant } from '@/lib/store-product';

/** Multiple distinct EUR prices → selectable variants on the product page. */
export function kinguinPriceVariantsFromJson(p: KinguinProductJson): KinguinPriceVariant[] | undefined {
  const rows: KinguinPriceVariant[] = [];
  const seen = new Set<number>();

  const push = (id: string, label: string, eur: number) => {
    if (!Number.isFinite(eur) || eur <= 0) return;
    const k = Math.round(eur * 10_000);
    if (seen.has(k)) return;
    seen.add(k);
    rows.push({ id, label, priceEur: eur });
  };

  push('k-main', 'Main offer', p.price);

  const offers = p.offers ?? [];
  for (let i = 0; i < offers.length; i++) {
    const o = offers[i]!;
    const label =
      (typeof o.merchantName === 'string' && o.merchantName.trim()) ||
      (typeof o.name === 'string' && o.name.trim()) ||
      `Offer ${i + 1}`;
    push(`k-offer-${i}`, label, o.price);
  }

  if (rows.length <= 1) return undefined;
  rows.sort((a, b) => a.priceEur - b.priceEur);
  return rows;
}
