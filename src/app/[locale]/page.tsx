"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Zap, TrendingUp, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import LazyWhenVisible from "@/components/ui/LazyWhenVisible";
import TrendingProductsSection from "@/components/home/TrendingProductsSection";

const HeroCarousel = dynamic(() => import("@/components/home/HeroCarousel"), {
  loading: () => (
    <div className="relative w-full max-w-7xl mx-auto px-2 sm:px-4 mt-2 md:mt-8" aria-hidden>
      <div className="relative h-[min(36vh,280px)] min-h-[220px] md:h-[min(520px,58vh)] md:min-h-[480px] w-full animate-pulse rounded-xl md:rounded-[40px] bg-surface-elevated/90 border border-edge shadow-[0_24px_48px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.04]" />
    </div>
  ),
  ssr: true,
});

export default function Home() {
  const t = useTranslations("Home");

  return (
    <div className="pb-24 md:pb-20">
      <HeroCarousel />

      <LazyWhenVisible minHeight="min-h-[360px] md:min-h-[280px]" rootMargin="80px 0px">
        <TrendingProductsSection />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="min-h-[240px] md:min-h-[200px]" rootMargin="80px 0px">
        <section className="max-w-7xl mx-auto px-3 sm:px-4 mt-14 md:mt-24 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8 content-below-fold">
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
      </LazyWhenVisible>
    </div>
  );
}
