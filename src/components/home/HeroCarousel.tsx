"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import type { StoreProduct } from "@/lib/store-product";
import { storefrontImageSrc } from "@/lib/storefront-image";
import CatalogCardImage from "@/components/ui/CatalogCardImage";

const HERO_LIMIT = 6;

function excerptDescription(raw: string | null, max = 200): string {
  if (!raw?.trim()) return "";
  const plain = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max).trimEnd()}…`;
}

/** Desktop hero blurb; hidden on mobile to save vertical space */
function heroSubtitle(p: StoreProduct, fallback: string) {
  const ex = excerptDescription(p.description, 72);
  if (ex) return ex;
  return fallback;
}

/** Scroll horizontally inside strip only — never use scrollIntoView (jumps the page on mobile). */
function scrollThumbCentered(
  strip: HTMLElement,
  thumb: HTMLElement,
  behavior: ScrollBehavior,
) {
  requestAnimationFrame(() => {
    if (strip.clientWidth === 0) return;
    const sr = strip.getBoundingClientRect();
    const tr = thumb.getBoundingClientRect();
    const delta = tr.left + tr.width / 2 - (sr.left + sr.width / 2);
    strip.scrollBy({ left: delta, behavior });
  });
}

export default function HeroCarousel() {
  const t = useTranslations("Product");
  const th = useTranslations("Home");
  const locale = useLocale();
  const { formatPrice } = useCart();
  const [slides, setSlides] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    fetch(`/api/products/hero`, {
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((data: { items?: StoreProduct[] }) => {
        setSlides(data.items ?? []);
        setActiveIndex(0);
      })
      .catch(() => {
        setSlides([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, []);

  const n = slides.length;
  const current = n > 0 ? slides[Math.min(activeIndex, n - 1)] : null;

  useEffect(() => {
    if (activeIndex >= n && n > 0) setActiveIndex(0);
  }, [activeIndex, n]);

  useEffect(() => {
    if (n === 0) return;
    const strip = thumbStripRef.current;
    const thumb = strip?.children[activeIndex] as HTMLElement | undefined;
    if (!strip || !thumb) return;
    scrollThumbCentered(strip, thumb, "smooth");
  }, [activeIndex, n]);

  const paginate = useCallback(
    (newDirection: number) => {
      if (n === 0) return;
      setDirection(newDirection);
      setActiveIndex((prev) => (prev + newDirection + n) % n);
    },
    [n],
  );

  useEffect(() => {
    if (n <= 1 || loading) return;
    const timer = setInterval(() => paginate(1), 5000);
    return () => clearInterval(timer);
  }, [n, paginate, loading]);

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? 1000 : -1000,
      opacity: 0,
    }),
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) =>
    Math.abs(offset) * velocity;

  if (!loading && n === 0) {
    return (
      <div className="relative w-full max-w-7xl mx-auto px-2 sm:px-4 mt-2 md:mt-8">
        <div className="rounded-2xl md:rounded-[40px] border border-dashed border-edge bg-surface-elevated/80 px-6 py-12 md:py-16 text-center">
          <p className="text-muted text-sm md:text-base mb-6 max-w-md mx-auto">
            {th("heroEmpty")}
          </p>
          <Link
            href="/search"
            className="inline-flex items-center justify-center rounded-xl bg-brand-orange px-8 py-3 text-sm font-semibold uppercase tracking-wider text-white shadow-lg shadow-brand-orange/25 hover:bg-brand-orange/90"
          >
            {th("heroBrowse")}
          </Link>
        </div>
      </div>
    );
  }

  const showSkeleton = loading && n === 0;

  const subtitleFor = (p: StoreProduct) =>
    heroSubtitle(p, th("heroNoDescription"));

  return (
    <div className="relative w-full max-w-7xl mx-auto px-2 sm:px-4 mt-2 md:mt-8 group">
      <div className="relative h-[min(36vh,280px)] min-h-[220px] md:h-[min(520px,58vh)] md:min-h-[480px] w-full bg-surface-elevated rounded-xl md:rounded-[40px] overflow-hidden shadow-[0_24px_48px_rgba(0,0,0,0.45)] border border-edge ring-1 ring-white/[0.04]">
        {showSkeleton ? (
          <div
            className="absolute inset-0 bg-gradient-to-br from-white/[0.07] via-surface-elevated to-surface-elevated animate-pulse"
            aria-busy
            aria-label={th("heroLoading")}
          />
        ) : (
          <>
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={current!.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(_, { offset, velocity }) => {
              const swipe = swipePower(offset.x, velocity.x);
              if (swipe < -swipeConfidenceThreshold) paginate(1);
              else if (swipe > swipeConfidenceThreshold) paginate(-1);
            }}
            className="absolute inset-0 size-full"
          >
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={storefrontImageSrc(current!.image)}
                alt=""
                loading="eager"
                decoding="async"
                fetchPriority="high"
                sizes="(max-width: 768px) 100vw, min(1280px, 100vw)"
                className="absolute inset-0 z-[1] size-full object-cover object-center"
              />
              {/* Strong scrim: text + glass panel sit on solid dark, not on cover art */}
              <div className="absolute inset-0 bg-gradient-to-t from-brand-dark from-25% via-brand-dark/85 via-45% to-transparent to-70% md:from-brand-dark/95 md:via-brand-dark/25 md:via-40% md:to-transparent md:to-65%" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-brand-dark/90 via-brand-dark/50 to-transparent to-55% md:via-brand-dark/35 md:to-58% rtl:bg-gradient-to-l" />
            </div>

            {/* Mobile: compact — no kicker/description; tight padding. md+: full hero copy */}
            <div className="absolute inset-x-0 bottom-0 top-0 z-20 flex flex-col justify-end text-start px-2 pb-2 pt-10 md:top-14 md:px-0 md:pb-6 md:ps-[4.5rem] md:pe-[4.5rem] md:pt-0">
              <div className="w-full max-w-xl pb-0 md:max-w-[min(34rem,46vw)] md:pb-10">
                <div className="rounded-xl border border-white/12 bg-brand-dark/85 px-3 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.5)] backdrop-blur-md md:rounded-3xl md:border-white/10 md:bg-brand-dark/70 md:px-8 md:py-8 md:shadow-xl md:shadow-black/40">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="mb-2 hidden min-h-0 items-center gap-2 md:mb-5 md:flex md:gap-3"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-brand-orange/35 bg-brand-orange/15 md:h-8 md:w-8 md:rounded-xl">
                      <Zap className="h-3 w-3 fill-brand-orange text-brand-orange md:h-4 md:w-4" />
                    </div>
                    <span className="section-kicker !text-white/60">{t("trending")}</span>
                  </motion.div>

                  <motion.h1
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mb-0 line-clamp-2 text-sm font-bold leading-tight tracking-tight text-white sm:line-clamp-3 sm:text-lg sm:leading-snug md:mb-4 md:line-clamp-4 md:text-4xl md:leading-tight lg:text-[2.65rem] lg:leading-[1.15]"
                  >
                    {current!.title}
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="mb-0 mt-2 hidden line-clamp-3 text-sm leading-relaxed text-white/80 md:mb-8 md:mt-0 md:block md:text-base"
                  >
                    {subtitleFor(current!)}
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-2.5 flex flex-row flex-wrap items-center gap-2 md:mt-0 md:flex-row md:items-center md:gap-6"
                  >
                    <Link
                      href={`/product/${current!.id}`}
                      className="inline-flex min-w-0 max-md:flex-1 max-md:min-w-[60%] sm:max-w-sm md:w-auto md:max-w-sm md:flex-initial"
                    >
                      <span className="inline-flex min-h-10 w-full touch-manipulation items-center justify-center gap-2 rounded-lg bg-brand-orange px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-white shadow-lg shadow-brand-orange/25 outline-none transition-all hover:bg-brand-orange/90 active:scale-[0.99] sm:min-h-12 sm:rounded-xl sm:px-6 sm:py-3.5 sm:text-sm md:px-10 md:py-4 md:text-base">
                        <span className="min-w-0 truncate">{t("buyNow")}</span>
                        <span className="shrink-0 opacity-30">|</span>
                        <span className="shrink-0 tabular-nums" dir="ltr" translate="no">
                          {formatPrice(current!.price, locale)}
                        </span>
                      </span>
                    </Link>
                    <div className="flex shrink-0 items-center gap-1.5 md:gap-2 md:ps-0">
                      <div className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-green-500 md:h-2 md:w-2" />
                      <span className="text-[9px] font-medium uppercase tracking-wider text-white/75 md:text-[11px]">
                        {t("delivery")}
                      </span>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 hidden -translate-y-1/2 justify-between px-3 md:flex">
          <button
            type="button"
            onClick={() => paginate(-1)}
            className="pointer-events-auto inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/50 text-white shadow-lg backdrop-blur-md transition-all hover:bg-black/65 active:scale-95 touch-manipulation"
            aria-label="Previous"
          >
            <ChevronLeft size={24} className="rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => paginate(1)}
            className="pointer-events-auto inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/50 text-white shadow-lg backdrop-blur-md transition-all hover:bg-black/65 active:scale-95 touch-manipulation"
            aria-label="Next"
          >
            <ChevronRight size={24} className="rtl:rotate-180" />
          </button>
        </div>
          </>
        )}
      </div>

      {/* Mobile: simple dots, Desktop: thumbnails */}
      {!showSkeleton && (
      <div className="mt-2 flex items-center justify-center gap-1.5 md:hidden" role="tablist" aria-label="Hero products">
        {slides.map((product, index) => {
          const active = activeIndex === index;
          return (
            <button
              key={`dot-${product.id}`}
              type="button"
              aria-selected={active}
              aria-label={product.title}
              onClick={() => {
                setDirection(index > activeIndex ? 1 : -1);
                setActiveIndex(index);
              }}
              className={active ? "h-2.5 w-6 rounded-full bg-brand-orange" : "h-2.5 w-2.5 rounded-full bg-white/35"}
            />
          );
        })}
      </div>
      )}

      {!showSkeleton && (
      <div className="relative z-0 mx-auto mt-4 hidden max-w-7xl px-3 pb-0 sm:px-4 md:mt-8 md:block md:pb-0">
        <div
          ref={thumbStripRef}
          role="tablist"
          aria-label="Hero products"
          className="relative z-0 overflow-visible md:grid md:gap-3 md:px-0 md:py-0 md:pb-2"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        >
          {slides.map((product, index) => {
            const active = activeIndex === index;
            return (
              <button
                key={product.id}
                type="button"
                role="tab"
                aria-selected={active}
                title={product.title}
                onClick={() => {
                  setDirection(index > activeIndex ? 1 : -1);
                  setActiveIndex(index);
                }}
                className={[
                  "relative isolate overflow-hidden rounded-2xl border-2 outline-none transition-[border-color,box-shadow] duration-200 md:h-[5rem] md:w-full md:min-w-0 md:max-w-none lg:rounded-3xl",
                  active
                    ? "border-brand-orange shadow-md shadow-brand-orange/20 ring-1 ring-brand-orange/40 md:shadow-[0_8px_24px_rgba(255,107,0,0.22)] md:ring-2"
                    : "border-white/15 hover:border-white/35",
                ].join(" ")}
              >
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md sm:rounded-[10px] md:rounded-[14px] lg:rounded-[22px]">
                  <CatalogCardImage
                    src={product.image}
                    alt=""
                    className="absolute inset-0 size-full"
                  />
                  <div
                    className={
                      active
                        ? "absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25"
                        : "absolute inset-0 bg-gradient-to-t from-black/[0.92] via-black/60 to-black/40"
                    }
                  />
                </div>

                {/* intentionally no title ribbon / bottom active line */}
              </button>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}
