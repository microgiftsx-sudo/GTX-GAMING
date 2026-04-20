import type { PlatiGoodsItem } from "@/lib/plati/types";

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v != null && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

function num(v: unknown): number {
  const n = Number(typeof v === "string" ? v.replace(",", ".") : v);
  return Number.isFinite(n) ? n : 0;
}

function ensureRowArray(rowsNode: unknown): Record<string, unknown>[] {
  const rows = asRecord(rowsNode);
  if (!rows) return [];
  const row = rows.row;
  if (row == null) return [];
  const list = Array.isArray(row) ? row : [row];
  return list.map((x) => asRecord(x)).filter(Boolean) as Record<string, unknown>[];
}

function mapSaleInfo(sale: unknown): Record<string, unknown> {
  return asRecord(sale) ?? {};
}

export function mapRowToPlatiGoodsItem(row: Record<string, unknown>): PlatiGoodsItem {
  const sale = mapSaleInfo(row.sale_info);

  return {
    id: str(row.id_goods),
    title: str(row.name_goods),
    price: num(row.price),
    currency: str(row.currency),
    discount: str(row.discount),
    isGiftCard: str(row.gift).toLowerCase() === "yes",
    rewardPercent: str(row.reward),
    sellerId: str(row.id_seller),
    sellerName: str(row.name_seller),
    rating: str(row.rating),
    summpay: str(row.summpay),
    salePercent: str(sale.sale_percent) || undefined,
    commonPriceUsd: str(sale.common_price_usd) || undefined,
    commonPriceEur: str(sale.common_price_eur) || undefined,
  };
}

export function mapRowsNodeToItems(rowsNode: unknown): PlatiGoodsItem[] {
  return ensureRowArray(rowsNode).map(mapRowToPlatiGoodsItem);
}
