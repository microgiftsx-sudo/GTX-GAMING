import type { PlatiGoodsItem } from "@/lib/plati/types";
import { eurToIqd, usdToIqd } from "@/lib/currency";
import type { StoreProduct } from "@/lib/store-product";
import { discountBadgeVisible } from "@/lib/store-product";

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&w=600&q=60";

/** Digiseller / Plati checkout (goods id = id_goods from XML). */
export function platiGoodsBuyUrl(goodsId: string): string {
  const id = encodeURIComponent(goodsId.trim());
  return `https://oplata.info/asp/pay_wm.asp?id_d=${id}&lang=en-US`;
}

function platiListPriceIqd(price: number, currency: string): number {
  const c = currency.trim().toUpperCase();
  if (c === "EUR" || c === "EU") return Math.round(eurToIqd(price));
  if (c === "USD" || c === "US" || c === "USD ") return Math.round(usdToIqd(price));
  if (c === "RUR" || c === "RUB") return Math.round(usdToIqd(price * 0.011));
  return Math.round(usdToIqd(price));
}

function platiDiscountLabel(item: PlatiGoodsItem): string {
  const sp = item.salePercent?.trim();
  if (sp && /^\d/.test(sp)) {
    const n = Number(sp.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n > 0) return `-${Math.round(n)}%`;
  }
  const d = item.discount?.trim();
  if (d && /^-\d+%$/.test(d)) return d;
  return "—";
}

/**
 * Map Plati XML row → storefront shape (checkout is external on Plati / Digiseller).
 */
export function fromPlatiGoodsItem(item: PlatiGoodsItem): StoreProduct {
  const listIqd = platiListPriceIqd(item.price, item.currency || "USD");
  const discount = platiDiscountLabel(item);
  const showStrike =
    discountBadgeVisible(discount) && Boolean(item.commonPriceUsd?.trim());
  const strikeIqd = showStrike
    ? Math.round(usdToIqd(Number(item.commonPriceUsd!.replace(",", ".")) || listIqd))
    : listIqd;
  const originalPrice = Math.max(listIqd, strikeIqd);

  const gid = item.id.trim();
  return {
    id: `plati-${gid}`,
    kinguinId: Number.parseInt(gid, 10) || 0,
    title: item.title.trim() || `Product ${gid}`,
    price: listIqd,
    originalPrice,
    discount,
    category: "games",
    platform: "pc",
    region: "global",
    image: PLACEHOLDER_IMAGE,
    description: item.sellerName ? `Seller: ${item.sellerName}` : null,
    source: "plati",
    externalBuyUrl: platiGoodsBuyUrl(gid),
  };
}
