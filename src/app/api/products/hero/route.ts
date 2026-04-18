import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import '@/lib/load-env';
import {
  getHeroProductIds,
  getHeroStoreProducts,
  getHeroCacheTtlSeconds,
  HERO_CAROUSEL_CACHE_TAG,
} from '@/lib/hero-products';
import { getTaxRatePercent } from '@/lib/tax';

export async function GET() {
  try {
    const ids = await getHeroProductIds();
    const idsKey = ids.length ? ids.join(',') : 'catalog';
    const taxRate = await getTaxRatePercent();
    const ttl = await getHeroCacheTtlSeconds();

    const items = await unstable_cache(
      async () => getHeroStoreProducts(),
      ['hero-store-products-v3', idsKey, String(taxRate)],
      { revalidate: ttl, tags: [HERO_CAROUSEL_CACHE_TAG] },
    )();

    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
