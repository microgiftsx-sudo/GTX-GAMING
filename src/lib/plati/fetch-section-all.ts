import { fetchPlatiGoodsBySection } from "@/lib/plati/client";
import type { PlatiGoodsItem } from "@/lib/plati/types";

const DEFAULT_ROWS = 500;

function maxPagesFromEnv(): number {
  const raw = process.env.PLATI_MAX_PAGES?.trim();
  if (!raw) return 500;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 500;
  return Math.min(n, 2000);
}

/**
 * Walks every page of a Plati `id_section` (XML f=2) until the API reports no more pages.
 * Dedupes by `id_goods`. Stops after `PLATI_MAX_PAGES` (default 500) to avoid runaway loops.
 */
export async function fetchPlatiSectionAllItems(idSection: string): Promise<{
  items: PlatiGoodsItem[];
  cntGoods: number;
  pagesFetched: number;
}> {
  const maxPages = maxPagesFromEnv();
  const byId = new Map<string, PlatiGoodsItem>();

  const first = await fetchPlatiGoodsBySection({
    idSection,
    page: 1,
    rows: DEFAULT_ROWS,
    lang: "en-US",
    encoding: "utf-8",
    currency: "USD",
    order: "",
  });

  for (const it of first.items) {
    byId.set(it.id, it);
  }

  const totalPagesReported = Math.max(1, first.pages);
  const pagesToFetch = Math.min(totalPagesReported, maxPages);

  for (let p = 2; p <= pagesToFetch; p++) {
    const r = await fetchPlatiGoodsBySection({
      idSection,
      page: p,
      rows: DEFAULT_ROWS,
      lang: "en-US",
      encoding: "utf-8",
      currency: "USD",
      order: "",
    });
    for (const it of r.items) {
      if (!byId.has(it.id)) byId.set(it.id, it);
    }
  }

  return {
    items: [...byId.values()],
    cntGoods: first.cntGoods,
    pagesFetched: pagesToFetch,
  };
}
