import type { PlatiGoodsItem } from "@/lib/plati/types";
import { getPlatiSectionFullCached } from "@/lib/plati/section-full-cache";

export async function findPlatiGoodsById(goodsId: string): Promise<PlatiGoodsItem | null> {
  const id = goodsId.trim();
  if (!id) return null;

  const all = await getPlatiSectionFullCached();
  return all.find((i) => i.id === id) ?? null;
}
