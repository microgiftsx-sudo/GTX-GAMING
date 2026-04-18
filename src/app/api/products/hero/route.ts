import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import '@/lib/load-env';
import { getHeroProductIds, getHeroStoreProducts } from '@/lib/hero-products';
import { getBaghdadDayKey } from '@/lib/daily-cache-key';

export async function GET() {
  try {
    const ids = await getHeroProductIds();
    const dayKey = getBaghdadDayKey();
    const idsKey = ids.length ? ids.join(',') : 'catalog';

    const items = await unstable_cache(
      async () => getHeroStoreProducts(),
      ['hero-store-products-v1', dayKey, idsKey],
      { revalidate: 86400 },
    )();

    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
