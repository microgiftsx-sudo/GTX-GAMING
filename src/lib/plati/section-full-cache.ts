import { unstable_cache } from "next/cache";
import { CATALOG_LISTING_TAG, PLATI_SECTION_FULL_TAG } from "@/lib/catalog-sources";
import { fetchPlatiSectionAllItems } from "@/lib/plati/fetch-section-all";
import type { PlatiGoodsItem } from "@/lib/plati/types";

function fullCacheRevalidateSeconds(): number {
  const raw = process.env.PLATI_FULL_CACHE_SECONDS?.trim();
  if (!raw) return 3600;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 60) return 3600;
  return Math.min(n, 86400 * 7);
}

/**
 * Full product list for `PLATI_DEFAULT_SECTION_ID` (all pages, deduped).
 * Cached separately from `/api/products` rows so one cold fetch fills pagination.
 */
export async function getPlatiSectionFullCached(): Promise<PlatiGoodsItem[]> {
  const sectionId = process.env.PLATI_DEFAULT_SECTION_ID?.trim();
  const agent = process.env.PLATI_GUID_AGENT?.trim();
  if (!sectionId || !agent) return [];

  const ttl = fullCacheRevalidateSeconds();

  return unstable_cache(
    async () => {
      const { items } = await fetchPlatiSectionAllItems(sectionId);
      return items;
    },
    ["plati-section-full-v1", sectionId, String(agent.length), String(ttl)],
    {
      revalidate: ttl,
      tags: [CATALOG_LISTING_TAG, PLATI_SECTION_FULL_TAG],
    },
  )();
}
