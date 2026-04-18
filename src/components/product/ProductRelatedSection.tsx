"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useCart } from "@/context/CartContext";
import { useTranslations, useLocale } from "next-intl";
import type { StoreProduct, StoreProductDetail } from "@/lib/store-product";
import { discountBadgeVisible } from "@/lib/store-product";
import CatalogCardImage from "@/components/ui/CatalogCardImage";
import DiscountBadge from "@/components/ui/DiscountBadge";

const RELATED_CARD_SIZES = "(max-width: 1023px) 50vw, 25vw";

const MAX_RELATED = 8;

function pickRelated(pool: StoreProduct[], current: StoreProductDetail): StoreProduct[] {
  const others = pool.filter((p) => p.id !== current.id);
  const sameCat = others.filter((p) => p.category === current.category);
  const rest = others.filter((p) => p.category !== current.category);
  return [...sameCat, ...rest].slice(0, MAX_RELATED);
}

async function fetchProductList(url: string): Promise<StoreProduct[]> {
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = (await r.json()) as { items?: StoreProduct[] };
  return data.items ?? [];
}

export default function ProductRelatedSection({ current }: { current: StoreProductDetail }) {
  const t = useTranslations("Product");
  const locale = useLocale();
  const { addItem, formatPrice } = useCart();
  const [items, setItems] = useState<StoreProduct[]>([]);

  const moreSearchHref = `/search?${new URLSearchParams({
    platform: current.platform,
    category: current.category,
  }).toString()}`;

  useEffect(() => {
    let cancelled = false;
    const platform = encodeURIComponent(current.platform);

    const run = async () => {
      let pool = await fetchProductList(
        `/api/products?platform=${platform}&limit=32&sort=relevance`
      );
      let picked = pickRelated(pool, current);
      if (picked.length < 4) {
        const broad = await fetchProductList(`/api/products?limit=40&sort=relevance`);
        const byId = new Map<string, StoreProduct>();
        for (const p of pool) byId.set(p.id, p);
        for (const p of broad) {
          if (!byId.has(p.id)) byId.set(p.id, p);
        }
        pool = Array.from(byId.values());
        picked = pickRelated(pool, current);
      }
      if (!cancelled) setItems(picked);
    };

    run().catch(() => {
      if (!cancelled) setItems([]);
    });
    return () => {
      cancelled = true;
    };
  }, [current.id, current.category, current.platform]);

  if (items.length === 0) return null;

  return (
    <section className="mt-12 md:mt-16 content-below-fold" aria-labelledby="product-related-heading">
      <div className="flex items-center justify-between gap-3 mb-5 md:mb-8">
        <h2
          id="product-related-heading"
          className="text-lg md:text-2xl font-bold tracking-tight text-foreground min-w-0 truncate"
        >
          {t("youMayAlsoLike")}
        </h2>
        <Link
          href={moreSearchHref}
          className="shrink-0 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted hover:text-brand-orange transition-colors flex items-center gap-1.5 outline-none min-h-11 px-1 -me-1 touch-manipulation"
        >
          {t("viewMore")}
          <ChevronRight size={14} className="transition-transform rtl:rotate-180 md:size-[16px]" />
        </Link>
      </div>

      <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-6 md:grid-cols-4 md:gap-8">
        {items.map((product, index) => (
          <motion.div
            layout
            key={product.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="group flex min-h-0 flex-col"
          >
            <div className="mb-2 shrink-0 overflow-hidden rounded-xl border border-edge bg-surface-elevated shadow-lg shadow-black/30 ring-1 ring-white/[0.04] md:mb-3 md:rounded-2xl">
              <Link
                href={`/product/${product.id}`}
                className="relative block aspect-[160/150] w-full touch-manipulation overflow-hidden"
              >
                <CatalogCardImage
                  src={product.image}
                  alt={product.title}
                  sizes={RELATED_CARD_SIZES}
                  fetchPriority={index < 4 ? "auto" : "low"}
                  className="absolute inset-0 size-full transition-transform duration-500 md:group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-dark/80 via-transparent to-transparent opacity-70 transition-opacity md:opacity-0 md:group-hover:opacity-100" />

                {discountBadgeVisible(product.discount) && (
                  <DiscountBadge variant="card">
                    <span dir="ltr">{product.discount}</span>
                  </DiscountBadge>
                )}

                <div className="absolute inset-0 hidden items-center justify-center px-3 opacity-0 transition-all md:flex md:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      addItem({
                        id: product.id,
                        title: product.title,
                        price: product.price,
                        image: product.image,
                        quantity: 1,
                      });
                    }}
                    className="w-full max-w-[200px] rounded-xl bg-brand-orange py-3 text-[10px] font-semibold uppercase tracking-wider text-white shadow-lg shadow-brand-orange/25 hover:bg-brand-orange/90"
                  >
                    {t("addToCart")}
                  </button>
                </div>
              </Link>
            </div>

            <div className="mt-2 flex min-h-[5.5rem] flex-col gap-2 px-0.5 md:hidden">
              <Link href={`/product/${product.id}`} className="block min-h-[2.75rem] min-w-0">
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                  {product.title}
                </h3>
              </Link>
              <div className="flex flex-col gap-2">
                <span
                  className="text-sm font-bold tabular-nums text-brand-blue"
                  lang="en"
                  translate="no"
                >
                  {formatPrice(product.price, locale)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    addItem({
                      id: product.id,
                      title: product.title,
                      price: product.price,
                      image: product.image,
                      quantity: 1,
                    })
                  }
                  className="min-h-11 w-full rounded-xl bg-brand-orange px-3 py-3 text-xs font-semibold uppercase tracking-wider text-white shadow-md shadow-brand-orange/20 transition-transform active:scale-[0.98] touch-manipulation"
                >
                  {t("addToCart")}
                </button>
              </div>
            </div>

            <div className="mt-2 hidden min-h-[4.25rem] flex-col gap-1 px-0.5 md:flex">
              <Link href={`/product/${product.id}`} className="block min-h-[2.75rem] min-w-0">
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-brand-orange">
                  {product.title}
                </h3>
              </Link>
              <span className="text-sm font-bold tabular-nums text-brand-blue" lang="en" translate="no">
                {formatPrice(product.price, locale)}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
