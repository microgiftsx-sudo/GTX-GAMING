"use client";

import React, { useEffect, useState } from "react";
import HeroCarousel from "@/components/home/HeroCarousel";
import { Zap, TrendingUp, Sparkles, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useCart } from "@/context/CartContext";
import { useTranslations, useLocale } from "next-intl";
import type { StoreProduct } from "@/lib/store-product";
import CatalogCardImage from "@/components/ui/CatalogCardImage";

export default function Home() {
  const t = useTranslations("Home");
  const tp = useTranslations("Product");
  const locale = useLocale();
  const { addItem, formatPrice } = useCart();
  const [items, setItems] = useState<StoreProduct[]>([]);

  useEffect(() => {
    fetch("/api/products?limit=10&sort=relevance")
      .then((r) => r.json())
      .then((data: { items?: StoreProduct[] }) => setItems(data.items ?? []))
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="pb-24 md:pb-20">
      <HeroCarousel />

      <section className="relative z-[1] isolate max-w-7xl mx-auto px-3 sm:px-4 mt-12 md:mt-20">
        <div className="flex items-center justify-between gap-3 mb-5 md:mb-8">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="p-2 shrink-0 bg-brand-orange/15 rounded-xl text-brand-orange ring-1 ring-brand-orange/20">
              <TrendingUp size={20} className="md:size-[24px]" />
            </div>
            <h2 className="text-lg sm:text-xl md:text-3xl font-bold tracking-tight text-foreground truncate">
              {t("trendingTitle")}{" "}
              <span className="text-brand-orange font-semibold">{t("now")}</span>
            </h2>
          </div>
          <Link
            href="/search"
            className="shrink-0 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted hover:text-brand-orange transition-colors flex items-center gap-1.5 outline-none min-h-11 px-1 -me-1 touch-manipulation"
          >
            {t("viewAll")}
            <ChevronRight
              size={14}
              className="transition-transform rtl:rotate-180 md:size-[16px]"
            />
          </Link>
        </div>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 items-stretch gap-5 md:gap-6">
          {items.map((game) => (
            <article
              key={game.id}
              className="group flex min-h-0 flex-col"
            >
              <div className="mb-2 shrink-0 overflow-hidden rounded-xl border border-edge bg-surface-elevated shadow-lg shadow-black/30 ring-1 ring-white/[0.04] md:mb-3 md:rounded-2xl">
                <Link
                  href={`/product/${game.id}`}
                  className="relative block aspect-[3/4] w-full touch-manipulation overflow-hidden"
                >
                  <CatalogCardImage
                    src={game.image}
                    alt={game.title}
                    className="absolute inset-0 size-full transition-transform duration-500 md:group-hover:scale-105"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-dark/80 via-transparent to-transparent opacity-70 transition-opacity md:opacity-0 md:group-hover:opacity-100" />

                  <div className="absolute top-2 end-2 z-10 md:top-3 md:end-2 bg-brand-purple/90 text-white text-[9px] md:text-[10px] font-semibold px-1.5 py-0.5 md:px-2 md:py-1 rounded-md md:rounded-lg ring-1 ring-white/10" lang="en" translate="no">
                    {game.discount}
                  </div>

                  <div className="absolute inset-0 hidden md:flex items-center justify-center px-3 opacity-0 md:group-hover:opacity-100 transition-all">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        addItem({
                          id: game.id,
                          title: game.title,
                          price: game.price,
                          image: game.image,
                          quantity: 1,
                        });
                      }}
                      className="w-full max-w-[200px] py-3 bg-brand-orange text-white font-semibold text-[10px] uppercase tracking-wider rounded-xl shadow-lg shadow-brand-orange/25 hover:bg-brand-orange/90"
                    >
                      {tp("addToCart")}
                    </button>
                  </div>
                </Link>
              </div>

              <div className="mt-2 flex min-h-[5.5rem] flex-col gap-2 px-0.5 md:hidden">
                <Link href={`/product/${game.id}`} className="block min-h-[2.75rem] min-w-0">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                    {game.title}
                  </h3>
                </Link>
                <div className="flex flex-col gap-2">
                  <span className="text-brand-blue font-bold text-sm tabular-nums" lang="en" translate="no">
                    {formatPrice(game.price, locale)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      addItem({
                        id: game.id,
                        title: game.title,
                        price: game.price,
                        image: game.image,
                        quantity: 1,
                      })
                    }
                    className="w-full py-3 min-h-11 px-3 rounded-xl bg-brand-orange text-white text-xs font-semibold uppercase tracking-wider shadow-md shadow-brand-orange/20 active:scale-[0.98] transition-transform touch-manipulation"
                  >
                    {tp("addToCart")}
                  </button>
                </div>
              </div>

              <div className="mt-2 hidden min-h-[4.25rem] flex-col gap-1 px-0.5 md:flex">
                <Link href={`/product/${game.id}`} className="block min-h-[2.75rem] min-w-0">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-brand-orange">
                    {game.title}
                  </h3>
                </Link>
                <span className="text-brand-blue font-bold text-sm tabular-nums" lang="en" translate="no">
                  {formatPrice(game.price, locale)}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-3 sm:px-4 mt-14 md:mt-24 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8">
        {[
          {
            icon: <Zap className="text-brand-orange" />,
            title: t("instantAccess"),
            desc: t("instantAccessDesc"),
          },
          {
            icon: <Sparkles className="text-brand-purple" />,
            title: t("premiumSupport"),
            desc: t("premiumSupportDesc"),
          },
          {
            icon: <TrendingUp className="text-brand-blue" />,
            title: t("bestPrices"),
            desc: t("bestPricesDesc"),
          },
        ].map((item, i) => (
          <div
            key={i}
            className="card-surface p-5 md:p-8 hover:border-brand-orange/20 transition-colors text-center md:text-start"
          >
            <div className="mb-3 md:mb-6 inline-flex items-center justify-center md:inline-block">
              {React.cloneElement(item.icon as React.ReactElement<{ size?: number }>, {
                size: 32,
              })}
            </div>
            <h3 className="text-base md:text-xl font-bold tracking-tight text-foreground mb-2 md:mb-3">
              {item.title}
            </h3>
            <p className="text-sm text-muted leading-relaxed mx-auto md:mx-0 max-w-[280px] md:max-w-none">
              {item.desc}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
