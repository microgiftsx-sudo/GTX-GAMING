import { NextRequest, NextResponse } from "next/server";
import "@/lib/load-env";
import { fetchPlatiGoodsBySection } from "@/lib/plati/client";

const ALLOWED_LANG = new Set(["ru-RU", "en-US"]);
const ALLOWED_CURRENCY = new Set(["USD", "RUR", "EUR", "UAH"]);

/** Digiseller docs: name, nameDESC, price, priceDESC, rating, ratingDESC, or empty */
const ALLOWED_ORDER = new Set([
  "",
  "name",
  "nameDESC",
  "price",
  "priceDESC",
  "rating",
  "ratingDESC",
]);

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const section =
      sp.get("section")?.trim() ||
      process.env.PLATI_DEFAULT_SECTION_ID?.trim() ||
      "";
    if (!section) {
      return NextResponse.json(
        {
          error:
            "Missing section (id_section). Pass ?section=... or set PLATI_DEFAULT_SECTION_ID.",
        },
        { status: 400 },
      );
    }

    if (!process.env.PLATI_GUID_AGENT?.trim()) {
      return NextResponse.json(
        { error: "PLATI_GUID_AGENT is not set on the server." },
        { status: 503 },
      );
    }

    const page = Math.max(1, Number(sp.get("page")) || 1);
    const rows = Math.min(500, Math.max(1, Number(sp.get("rows")) || 24));
    const langRaw = sp.get("lang")?.trim() || "en-US";
    const lang = ALLOWED_LANG.has(langRaw) ? langRaw : "en-US";
    const currencyRaw = (sp.get("currency")?.trim() || "USD").toUpperCase();
    const currency = ALLOWED_CURRENCY.has(currencyRaw) ? currencyRaw : "USD";
    const orderRaw = sp.get("order")?.trim() || "";
    const order = ALLOWED_ORDER.has(orderRaw) ? orderRaw : "";
    const encoding = sp.get("encoding")?.trim() || "utf-8";

    const result = await fetchPlatiGoodsBySection({
      idSection: section,
      lang,
      encoding,
      page,
      rows,
      currency,
      order,
    });

    return NextResponse.json({
      retval: result.retval,
      retdesc: result.retdesc,
      id_section: result.idSection,
      name_section: result.nameSection,
      cnt_goods: result.cntGoods,
      pages: result.pages,
      page: result.page,
      order: result.order,
      items: result.items,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
