import { fetchPlatiGoodsBySection } from "@/lib/plati/client";
import type { PlatiGoodsItem } from "@/lib/plati/types";

const MAX_PAGE_SCAN = 30;

function getDefaultSection(): string | null {
  const s = process.env.PLATI_DEFAULT_SECTION_ID?.trim();
  return s || null;
}

export async function findPlatiGoodsById(goodsId: string): Promise<PlatiGoodsItem | null> {
  const id = goodsId.trim();
  if (!id) return null;
  const section = getDefaultSection();
  if (!section) return null;

  for (let page = 1; page <= MAX_PAGE_SCAN; page++) {
    const r = await fetchPlatiGoodsBySection({
      idSection: section,
      page,
      rows: 200,
      lang: "en-US",
      encoding: "utf-8",
      currency: "USD",
      order: "",
    });
    const hit = r.items.find((i) => i.id === id);
    if (hit) return hit;
    if (page >= r.pages || r.pages <= 0) break;
  }
  return null;
}
