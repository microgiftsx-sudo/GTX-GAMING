import { getDigisellerSellerToken } from "@/lib/digiseller/token";
import type { DigisellerSellerConfig } from "@/lib/digiseller/env";

const BASE = "https://api.digiseller.com";

export async function digisellerSellerGetJson(
  cfg: DigisellerSellerConfig,
  path: string,
  extraSearch?: URLSearchParams,
): Promise<unknown> {
  const token = await getDigisellerSellerToken(cfg);
  const rel = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${BASE}${rel}`);
  url.searchParams.set("token", token);
  if (extraSearch) {
    for (const [k, v] of extraSearch) {
      if (k.toLowerCase() !== "token") url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    parsed = { _nonJson: text.slice(0, 500) };
  }

  if (!res.ok) {
    throw new Error(`Digiseller HTTP ${res.status}`);
  }

  return parsed;
}
