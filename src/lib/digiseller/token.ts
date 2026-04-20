import crypto from "node:crypto";
import type { DigisellerSellerConfig } from "@/lib/digiseller/env";

const BASE = "https://api.digiseller.com";

export type ApiloginJson = {
  retval: number;
  desc?: string;
  endesc?: string;
  token?: string;
  seller_id?: number;
  valid_thru?: string;
};

type TokenCache = { token: string; expiresAtMs: number };

let cache: TokenCache | null = null;
let cacheKey = "";

function sign(apiGuid: string, timestamp: number): string {
  return crypto.createHash("sha256").update(`${apiGuid}${timestamp}`).digest("hex");
}

export function clearDigisellerTokenCache(): void {
  cache = null;
  cacheKey = "";
}

/**
 * Obtains a short-lived seller token (Digiseller: ~2h validity).
 * @see https://api.digiseller.com/Help/Api/POST-api-apilogin
 */
export async function getDigisellerSellerToken(cfg: DigisellerSellerConfig): Promise<string> {
  const key = `${cfg.sellerId}:${cfg.apiGuid}`;
  const now = Date.now();
  if (cache && cacheKey === key && cache.expiresAtMs > now + 30_000) {
    return cache.token;
  }

  const timestamp = Math.floor(now / 1000);
  const body = {
    seller_id: cfg.sellerId,
    timestamp,
    sign: sign(cfg.apiGuid, timestamp),
  };

  const res = await fetch(`${BASE}/api/apilogin`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as ApiloginJson;
  if (data.retval !== 0 || !data.token) {
    const msg = data.endesc || data.desc || `Digiseller apilogin retval=${data.retval}`;
    throw new Error(msg);
  }

  let expiresAtMs = now + 100 * 60 * 1000;
  if (data.valid_thru) {
    const parsed = Date.parse(data.valid_thru);
    if (Number.isFinite(parsed)) {
      expiresAtMs = parsed - 60_000;
    }
  }

  cache = { token: data.token, expiresAtMs };
  cacheKey = key;
  return data.token;
}

