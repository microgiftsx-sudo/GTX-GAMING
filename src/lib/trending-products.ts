import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataRoot } from "@/lib/data-root";
import { revalidateTag } from "next/cache";
import { fetchProductByKinguinId } from "@/lib/kinguin/client";
import { fromKinguinJson } from "@/lib/store-product";
import type { StoreProduct } from "@/lib/store-product";
import { applyVatToStoreProduct } from "@/lib/store-product-vat";

const FILE = path.join(getDataRoot(), "trending-products.json");

export const TRENDING_HOME_CACHE_TAG = "trending-home";

/** Home “Trending now” strip capacity */
export const TRENDING_HOME_MAX = 10;

type TrendingSettings = {
  ids: string[];
};

function uniqueKinguinIds(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw) {
    const t = String(s).trim();
    if (!t || seen.has(t)) continue;
    if (!/^\d+$/.test(t)) continue;
    const n = Number.parseInt(t, 10);
    if (!Number.isFinite(n) || n < 1) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= TRENDING_HOME_MAX) break;
  }
  return out;
}

async function readSettings(): Promise<TrendingSettings> {
  try {
    const raw = await readFile(FILE, "utf8");
    const data = JSON.parse(raw) as TrendingSettings;
    if (!Array.isArray(data.ids)) return { ids: [] };
    return { ids: uniqueKinguinIds(data.ids.map(String)) };
  } catch {
    return { ids: [] };
  }
}

async function writeSettings(settings: TrendingSettings): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(
    FILE,
    `${JSON.stringify({ ids: settings.ids }, null, 2)}\n`,
    "utf8",
  );
}

export function revalidateTrendingHome(): void {
  try {
    revalidateTag(TRENDING_HOME_CACHE_TAG, { expire: 0 });
  } catch {
    /* revalidateTag may throw outside request context */
  }
}

export async function getTrendingProductIds(): Promise<string[]> {
  const s = await readSettings();
  return s.ids;
}

export async function setTrendingProductIds(ids: string[]): Promise<string[]> {
  const next = uniqueKinguinIds(ids);
  await writeSettings({ ids: next });
  revalidateTrendingHome();
  return next;
}

/** Resolved products in configured order (caller handles empty ids → catalog fallback). */
export async function getTrendingStoreProductsByIds(
  ids: string[],
  taxRate: number,
): Promise<StoreProduct[]> {
  const items: StoreProduct[] = [];
  for (const id of ids) {
    const kid = Number.parseInt(id, 10);
    if (!Number.isFinite(kid)) continue;
    try {
      const json = await fetchProductByKinguinId(kid);
      items.push(applyVatToStoreProduct(fromKinguinJson(json), taxRate));
    } catch {
      /* omit missing or API errors */
    }
  }
  return items;
}
