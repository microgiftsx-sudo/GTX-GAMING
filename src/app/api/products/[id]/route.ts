import { NextRequest, NextResponse } from 'next/server';
import '@/lib/load-env';
import { getCatalogProductDetailUncached } from '@/lib/catalog/facade';
import { applyVatToStoreProduct } from '@/lib/store-product-vat';
import { getTaxRatePercent } from '@/lib/tax';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const kid = Number.parseInt(id, 10);
    if (!Number.isFinite(kid)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const detail = await getCatalogProductDetailUncached(kid);
    const taxRate = await getTaxRatePercent();
    const base = applyVatToStoreProduct(
      {
        id: detail.id,
        kinguinId: detail.kinguinId,
        title: detail.title,
        price: detail.price,
        originalPrice: detail.originalPrice,
        discount: detail.discount,
        category: detail.category,
        platform: detail.platform,
        region: detail.region,
        image: detail.image,
        description: detail.description,
      },
      taxRate,
    );
    return NextResponse.json({
      ...base,
      galleryUrls:
        detail.galleryUrls.length > 0 ? detail.galleryUrls : [base.image],
      youtubeIds: detail.youtubeIds,
      catalogSource: detail.catalogSource,
      platiOptionGroups: detail.platiOptionGroups,
      platiSelections: detail.platiSelections,
      platiCollection: detail.platiCollection,
      kinguinPriceVariants: detail.kinguinPriceVariants?.map((v) => ({
        id: v.id,
        label: v.label,
        priceEur: v.priceEur,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Kinguin 404|\b404\b|retval=\s*2|Not found/i.test(msg)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
