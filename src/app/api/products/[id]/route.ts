import { NextRequest, NextResponse } from "next/server";
import "@/lib/load-env";
import { fetchProductByKinguinId } from "@/lib/kinguin/client";
import { extractGalleryUrls, extractYoutubeIds } from "@/lib/kinguin/media";
import { fromKinguinJson } from "@/lib/store-product";
import { applyVatToStoreProduct } from "@/lib/store-product-vat";
import { getTaxRatePercent } from "@/lib/tax";
import { findPlatiGoodsById } from "@/lib/plati/find-product";
import { fromPlatiGoodsItem } from "@/lib/plati/to-store-product";

export const dynamic = "force-dynamic";

const PLATI_NOTE =
  "Partner listing (Plati / Digiseller). Purchase and delivery are completed on the partner checkout page, not through GTX cart checkout.";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const taxRate = await getTaxRatePercent();

    const platiMatch = /^plati-(\d+)$/i.exec(id.trim());
    if (platiMatch) {
      const goodsId = platiMatch[1];
      const row = await findPlatiGoodsById(goodsId);
      if (!row) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const base = applyVatToStoreProduct(fromPlatiGoodsItem(row), taxRate);
      return NextResponse.json({
        ...base,
        galleryUrls: [base.image],
        youtubeIds: [],
        partnerNote: PLATI_NOTE,
      });
    }

    const kid = Number.parseInt(id, 10);
    if (!Number.isFinite(kid)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const json = await fetchProductByKinguinId(kid);
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
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
