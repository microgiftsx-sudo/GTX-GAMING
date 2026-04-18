import { NextRequest, NextResponse } from 'next/server';
import '@/lib/load-env';
import { fetchProductsPage } from '@/lib/kinguin/client';
import { iqdToEur } from '@/lib/currency';
import { fromKinguinJson } from '@/lib/store-product';

export const dynamic = 'force-dynamic';

function categoriesToTags(categories: string[]): string | undefined {
  const parts: string[] = [];
  for (const c of categories) {
    if (c === 'cards') parts.push('prepaid');
    else if (c === 'software') parts.push('software');
    else if (c === 'dlc') parts.push('dlc');
  }
  if (parts.length === 0) return undefined;
  return [...new Set(parts)].join(',');
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const q = sp.get('q')?.trim() || '';
    const category = sp.get('category')?.split(',').filter(Boolean) ?? [];
    const platform = sp.get('platform')?.split(',').filter(Boolean) ?? [];
    const minPrice = Number(sp.get('minPrice')) || 0;
    const maxRaw = sp.get('maxPrice');
    const maxPrice =
      maxRaw != null && maxRaw !== '' ? Number(maxRaw) : Infinity;
    const sort = sp.get('sort') || 'relevance';
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit')) || 24));

    const tags = categoriesToTags(category);
    const platformParam =
      platform.length > 0 ? platform.map((p) => p.toLowerCase()).join(',') : undefined;

    const minEur = minPrice > 0 ? iqdToEur(minPrice) : undefined;
    const maxEur =
      Number.isFinite(maxPrice) && maxPrice < Number.MAX_SAFE_INTEGER / 4
        ? iqdToEur(maxPrice)
        : undefined;

    const data = await fetchProductsPage({
      page,
      limit,
      sortBy: 'updatedAt',
      sortType: 'desc',
      name: q.length >= 3 ? q : undefined,
      platform: platformParam,
      tags,
      priceFrom: minEur,
      priceTo: maxEur,
    });

    let items = (data.results ?? []).map(fromKinguinJson);

    if (sort === 'price-low') {
      items = [...items].sort((a, b) => a.price - b.price);
    } else if (sort === 'price-high') {
      items = [...items].sort((a, b) => b.price - a.price);
    }

    const total = data.item_count ?? items.length;

    return NextResponse.json({
      items,
      total,
      page,
      limit,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
