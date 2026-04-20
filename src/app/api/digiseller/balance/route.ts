import { NextRequest, NextResponse } from "next/server";
import "@/lib/load-env";
import { digisellerSellerGetJson } from "@/lib/digiseller/fetch-json";
import { getDigisellerSellerConfig, isDigisellerProxyAuthorized } from "@/lib/digiseller/env";

/**
 * Proxies Digiseller seller balance (requires apilogin token server-side).
 * @see https://api.digiseller.com/Help/Api/GET-api-sellers-account-balance-info
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

  try {
    const data = await digisellerSellerGetJson(cfg, "/api/sellers/account/balance/info");
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
