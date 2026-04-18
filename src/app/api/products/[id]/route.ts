import { NextRequest, NextResponse } from 'next/server';
import '@/lib/load-env';
import { fetchProductByKinguinId } from '@/lib/kinguin/client';
import { extractGalleryUrls, extractYoutubeIds } from '@/lib/kinguin/media';
import { fromKinguinJson } from '@/lib/store-product';
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

    const json = await fetchProductByKinguinId(kid);
    const taxRate = await getTaxRatePercent();
    const base = applyVatToStoreProduct(fromKinguinJson(json), taxRate);
    const galleryUrls = extractGalleryUrls(json);
    const youtubeIds = extractYoutubeIds(json);
    return NextResponse.json({
      ...base,
      galleryUrls: galleryUrls.length > 0 ? galleryUrls : [base.image],
      youtubeIds,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Kinguin 404|\b404\b/i.test(msg)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
