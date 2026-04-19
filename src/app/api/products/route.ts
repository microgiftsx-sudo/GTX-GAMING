import { NextRequest, NextResponse } from 'next/server';
import '@/lib/load-env';
import { getTaxRatePercent } from '@/lib/tax';
import {
  getCachedProductListing,
  type CachedProductsArgs,
} from '@/lib/catalog-query';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const q = sp.get('q')?.trim() || '';
    const category = sp.get('category')?.split(',').filter(Boolean) ?? [];
    const platform = sp.get('platform')?.split(',').filter(Boolean) ?? [];
    const minPrice = Number(sp.get('minPrice')) || 0;
    const maxRaw = sp.get('maxPrice');
    const sort = sp.get('sort') || 'relevance';
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit')) || 24));

    const taxRate = await getTaxRatePercent();

    const args: CachedProductsArgs = {
      page,
      limit,
      q,
      category,
      platform,
      minPrice,
      maxPriceRaw: maxRaw,
      sort,
      taxRate,
    };

    const payload = await getCachedProductListing(args);

    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
