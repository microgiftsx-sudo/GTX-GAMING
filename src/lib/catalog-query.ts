import { unstable_cache } from "next/cache";
import { fetchProductsPage } from "@/lib/kinguin/client";
import type { KinguinProductJson } from "@/lib/kinguin/types";
import { iqdToEur } from "@/lib/currency";
import { fromKinguinJson } from "@/lib/store-product";
import type { StoreProduct } from "@/lib/store-product";
import { applyVatToStoreProduct } from "@/lib/store-product-vat";
import { getBaghdadDayKey } from "@/lib/daily-cache-key";
import { fetchPlatiGoodsBySection } from "@/lib/plati/client";
import { fromPlatiGoodsItem } from "@/lib/plati/to-store-product";
import {
  CATALOG_LISTING_TAG,
  getCatalogSources,
  type CatalogSourcesState,
} from "@/lib/catalog-sources";

function categoriesToTags(categories: string[]): string | undefined {
  const parts: string[] = [];
  for (const c of categories) {
    if (c === "cards") parts.push("prepaid");
    else if (c === "software") parts.push("software");
    else if (c === "dlc") parts.push("dlc");
  }
  if (parts.length === 0) return undefined;
  return [...new Set(parts)].join(",");
}

export type CachedProductsArgs = {
  page: number;
  limit: number;
  q: string;
  category: string[];
  platform: string[];
  minPrice: number;
  maxPriceRaw: string | null;
  sort: string;
  taxRate: number;
};

function platiEnvReady(): boolean {
  return Boolean(
    process.env.PLATI_GUID_AGENT?.trim() && process.env.PLATI_DEFAULT_SECTION_ID?.trim(),
  );
}

function wantsPlatiMerge(sources: CatalogSourcesState, args: CachedProductsArgs): boolean {
  if (!sources.plati || !platiEnvReady()) return false;
  const q = args.q.trim();
  if (q.length >= 3) return false;
  if (args.category.length > 0 || args.platform.length > 0) return false;
  return true;
}

function applyIqdRangeFilter(
  items: StoreProduct[],
  minPrice: number,
  maxPriceRaw: string | null,
): StoreProduct[] {
  const maxPrice =
    maxPriceRaw != null && maxPriceRaw !== "" ? Number(maxPriceRaw) : Infinity;
  if (minPrice <= 0 && !Number.isFinite(maxPrice)) return items;
  return items.filter((p) => {
    if (minPrice > 0 && p.price < minPrice) return false;
    if (Number.isFinite(maxPrice) && maxPrice < Number.MAX_SAFE_INTEGER / 4 && p.price > maxPrice) {
      return false;
    }
    return true;
  });
}

function sortCatalogItems(items: StoreProduct[], sort: string): StoreProduct[] {
  if (sort === "price-low") {
    return [...items].sort((a, b) => a.price - b.price);
  }
  if (sort === "price-high") {
    return [...items].sort((a, b) => b.price - a.price);
  }
  return stabilizeCatalogOrder(items);
}

export async function fetchProductsUncached(
  args: CachedProductsArgs,
  sources: CatalogSourcesState,
) {
  const { page, limit, q, category, platform, minPrice, maxPriceRaw, sort, taxRate } = args;

  const maxPrice =
    maxPriceRaw != null && maxPriceRaw !== "" ? Number(maxPriceRaw) : Infinity;

  const tags = categoriesToTags(category);
  const platformParam =
    platform.length > 0 ? platform.map((p) => p.toLowerCase()).join(",") : undefined;

  const iqdToKinguinBase = (iqd: number) =>
    taxRate > 0 ? iqd / (1 + taxRate / 100) : iqd;

  const minEur = minPrice > 0 ? iqdToEur(iqdToKinguinBase(minPrice)) : undefined;
  const maxEur =
    Number.isFinite(maxPrice) && maxPrice < Number.MAX_SAFE_INTEGER / 4
      ? iqdToEur(iqdToKinguinBase(maxPrice))
      : undefined;

  const mergePlati = wantsPlatiMerge(sources, args);
  const sectionId = process.env.PLATI_DEFAULT_SECTION_ID?.trim() ?? "";

  /** Plati-only catalog (Kinguin disabled). */
  if (!sources.kinguin && sources.plati && platiEnvReady()) {
    const pData = await fetchPlatiGoodsBySection({
      idSection: sectionId,
      page,
      rows: Math.min(500, limit),
      lang: "en-US",
      encoding: "utf-8",
      currency: "USD",
      order: "",
    });
    let items = pData.items
      .map((i) => fromPlatiGoodsItem(i))
      .map((p) => applyVatToStoreProduct(p, taxRate));
    items = applyIqdRangeFilter(items, minPrice, maxPriceRaw);
    items = sortCatalogItems(items, sort);
    return {
      items: items.slice(0, limit),
      total: pData.cntGoods,
      page,
      limit,
    };
  }

  if (!sources.kinguin) {
    return { items: [], total: 0, page, limit };
  }

  const data = await fetchProductsPage({
    page,
    limit,
    sortBy: "updatedAt",
    sortType: "desc",
    name: q.length >= 3 ? q : undefined,
    platform: platformParam,
    tags,
    priceFrom: minEur,
    priceTo: maxEur,
  });

  let items = (data.results ?? [])
    .map((row) => fromKinguinJson(row as KinguinProductJson))
    .map((p) => applyVatToStoreProduct(p, taxRate));

  let platiCount = 0;
  if (mergePlati && sources.kinguin) {
    const pData = await fetchPlatiGoodsBySection({
      idSection: sectionId,
      page,
      rows: Math.min(500, limit),
      lang: "en-US",
      encoding: "utf-8",
      currency: "USD",
      order: "",
    });
    platiCount = pData.cntGoods;
    const platiItems = pData.items
      .map((i) => fromPlatiGoodsItem(i))
      .map((p) => applyVatToStoreProduct(p, taxRate));
    items = [...items, ...platiItems];
  }

  items = applyIqdRangeFilter(items, minPrice, maxPriceRaw);
  items = sortCatalogItems(items, sort);
  items = items.slice(0, limit);

  const total = (data.item_count ?? items.length) + (mergePlati ? platiCount : 0);

  return {
    items,
    total,
    page,
    limit,
  };
}

/** Deterministic order for the same API payload (avoids unstable tie order from Kinguin). */
export function stabilizeCatalogOrder(items: StoreProduct[]): StoreProduct[] {
  return [...items].sort((a, b) => {
    const ka = a.source === "plati" ? Number(a.id.replace("plati-", "")) || 0 : a.kinguinId;
    const kb = b.source === "plati" ? Number(b.id.replace("plati-", "")) || 0 : b.kinguinId;
    return kb - ka;
  });
}

export async function getCachedProductListing(args: CachedProductsArgs) {
  const sources = await getCatalogSources();
  const dayKey = getBaghdadDayKey();
  const catKey = [...args.category].sort().join("|");
  const platKey = [...args.platform].sort().join("|");

  return unstable_cache(
    async () => fetchProductsUncached(args, sources),
    [
      "kinguin-products-v2",
      dayKey,
      String(args.taxRate),
      String(args.page),
      String(args.limit),
      args.sort,
      args.q,
      catKey,
      platKey,
      String(args.minPrice),
      args.maxPriceRaw === null ? "" : String(args.maxPriceRaw),
      `sk:${sources.kinguin}`,
      `sp:${sources.plati}`,
    ],
    { revalidate: 86400, tags: [CATALOG_LISTING_TAG] },
  )();
}
