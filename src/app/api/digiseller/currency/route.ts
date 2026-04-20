import { NextRequest, NextResponse } from "next/server";
import "@/lib/load-env";
import { digisellerSellerGetJson } from "@/lib/digiseller/fetch-json";
import { getDigisellerSellerConfig, isDigisellerProxyAuthorized } from "@/lib/digiseller/env";

const ALLOWED_BASE = new Set(["USD", "RUB", "EUR", "UAH"]);

/**
 * Digiseller exchange rates for the seller account.
 * @see https://my.digiseller.com/inside/api_seller_currencies.asp
 */
export async function GET(req: NextRequest) {
  if (!isDigisellerProxyAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cfg = getDigisellerSellerConfig();
  if (!cfg) {
    return NextResponse.json(
      {
        error:
          "Digiseller seller API is not configured. Set DIGISELLER_SELLER_ID and DIGISELLER_API_GUID.",
      },
      { status: 503 },
    );
  }

  const sp = new URLSearchParams();
  const raw = req.nextUrl.searchParams.get("base_currency")?.trim().toUpperCase();
  if (raw) {
    const norm = raw === "RUR" ? "RUB" : raw;
    if (ALLOWED_BASE.has(norm)) sp.set("base_currency", norm);
  }

  try {
    const data = await digisellerSellerGetJson(
      cfg,
      "/api/sellers/currency",
      sp.toString() ? sp : undefined,
    );
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
