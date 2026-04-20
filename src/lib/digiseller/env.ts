import type { NextRequest } from "next/server";

export type DigisellerSellerConfig = {
  sellerId: number;
  apiGuid: string;
};

export function getDigisellerSellerConfig(): DigisellerSellerConfig | null {
  const sellerRaw = process.env.DIGISELLER_SELLER_ID?.trim();
  const apiGuid = process.env.DIGISELLER_API_GUID?.trim();
  if (!sellerRaw || !apiGuid) return null;
  const sellerId = Number(sellerRaw);
  if (!Number.isFinite(sellerId) || sellerId <= 0) return null;
  return { sellerId, apiGuid };
}

/**
 * When DIGISELLER_PROXY_SECRET is set, callers must pass the same value via
 * `Authorization: Bearer …` or `?secret=…`.
 */
export function isDigisellerProxyAuthorized(req: NextRequest): boolean {
  const secret = process.env.DIGISELLER_PROXY_SECRET?.trim();
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  const bearer =
    auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const q = req.nextUrl.searchParams.get("secret")?.trim() ?? "";
  return bearer === secret || q === secret;
}
