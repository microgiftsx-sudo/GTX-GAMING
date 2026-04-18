import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import '@/lib/load-env';
import { fetchProductsPage } from '@/lib/kinguin/client';
import { iqdToEur } from '@/lib/currency';
import { fromKinguinJson } from '@/lib/store-product';
import { applyVatToStoreProduct } from '@/lib/store-product-vat';
import { getTaxRatePercent } from '@/lib/tax';
import { getBaghdadDayKey } from '@/lib/daily-cache-key';

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

type CachedProductsArgs = {
  page: number;
  limit: number;
  q: string;
  category: string[];
  platform: string[];
  minPrice: number;
  maxPriceRaw: string | null;
  sort: string;
  taxRate: number;
};

async function fetchProductsUncached(args: CachedProductsArgs) {
  const {
    page,
    limit,
    q,
    category,
    platform,
    minPrice,
    maxPriceRaw,
    sort,
    taxRate,
  } = args;

  const maxPrice =
    maxPriceRaw != null && maxPriceRaw !== '' ? Number(maxPriceRaw) : Infinity;

  const tags = categoriesToTags(category);
  const platformParam =
    platform.length > 0 ? platform.map((p) => p.toLowerCase()).join(',') : undefined;

  const iqdToKinguinBase = (iqd: number) =>
    taxRate > 0 ? iqd / (1 + taxRate / 100) : iqd;

  const minEur = minPrice > 0 ? iqdToEur(iqdToKinguinBase(minPrice)) : undefined;
  const maxEur =
    Number.isFinite(maxPrice) && maxPrice < Number.MAX_SAFE_INTEGER / 4
      ? iqdToEur(iqdToKinguinBase(maxPrice))
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

  let items = (data.results ?? [])
    .map(fromKinguinJson)
    .map((p) => applyVatToStoreProduct(p, taxRate));

  if (sort === 'price-low') {
    items = [...items].sort((a, b) => a.price - b.price);
  } else if (sort === 'price-high') {
    items = [...items].sort((a, b) => b.price - a.price);
  }

  const total = data.item_count ?? items.length;

  return {
    items,
    total,
    page,
    limit,
  };
}

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
    const dayKey = getBaghdadDayKey();

    const catKey = [...category].sort().join('|');
    const platKey = [...platform].sort().join('|');

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

    const payload = await unstable_cache(
      async () => fetchProductsUncached(args),
      [
        'kinguin-products-v1',
        dayKey,
        String(taxRate),
        String(page),
        String(limit),
        sort,
        q,
        catKey,
        platKey,
        String(minPrice),
        maxRaw === null ? '' : String(maxRaw),
      ],
      { revalidate: 86400 },
    )();

    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
