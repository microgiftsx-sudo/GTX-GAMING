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

/** Strip HTML and truncate at a word boundary so we never end mid-word (e.g. “…which”). */
function excerptDescription(raw: string | null, max = 200): string {
  if (!raw?.trim()) return "";
  const plain = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  const slice = plain.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const cut =
    lastSpace > Math.floor(max * 0.55) ? slice.slice(0, lastSpace) : slice.trimEnd();
  return `${cut}…`;
}

/** Desktop hero blurb; hidden on mobile to save vertical space */
function heroSubtitle(p: StoreProduct, fallback: string) {
  const ex = excerptDescription(p.description, 140);
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

type HeroCarouselProps = {
  /** From server — same catalog for every visitor until cache revalidates */
  initialSlides?: StoreProduct[];
};

export default function HeroCarousel({ initialSlides }: HeroCarouselProps) {
  const t = useTranslations("Product");
  const th = useTranslations("Home");
  const locale = useLocale();
  const { formatPrice } = useCart();
  const fromServer = initialSlides !== undefined;
  const [slides, setSlides] = useState<StoreProduct[]>(() => initialSlides ?? []);
  const [loading, setLoading] = useState(!fromServer);
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fromServer) return;
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
  }, [fromServer]);

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
      <div className="relative aspect-[16/10] max-h-[280px] min-h-[220px] md:aspect-auto md:h-[min(520px,58vh)] md:max-h-none md:min-h-[480px] w-full bg-surface-elevated rounded-xl md:rounded-[40px] overflow-hidden shadow-[0_24px_48px_rgba(0,0,0,0.45)] border border-edge ring-1 ring-white/[0.04]">
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
              {/* Mobile-only: blurred cover layer fills any letterbox bars behind the contained banner */}
              <img
                src={storefrontImageSrc(current!.image)}
                alt=""
                aria-hidden
                loading="eager"
                decoding="async"
                className="absolute inset-0 z-[0] size-full object-cover object-center scale-125 blur-xl opacity-60 md:hidden"
              />
              <img
                src={storefrontImageSrc(current!.image)}
                alt=""
                loading="eager"
                decoding="async"
                fetchPriority="high"
                sizes="(max-width: 768px) 100vw, min(1280px, 100vw)"
                className="absolute inset-0 z-[1] size-full object-contain object-center md:object-cover"
              />
              {/* Mobile: keep cover visible — light top vignette only; desktop: subtle top fade */}
              <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-black/25 via-transparent to-transparent to-[30%] md:from-brand-dark/35 md:via-transparent md:to-[50%]" />
            </div>

            {/* Bottom overlay: mobile = narrow strip (~40% height max) + no heavy card; md+ = full card */}
            <div className="absolute inset-x-0 bottom-0 z-20 flex max-h-[48%] flex-col justify-end text-start md:max-h-none">
              <div className="w-full bg-gradient-to-t from-brand-dark from-0% via-brand-dark/88 to-transparent to-100% px-3 pb-2 pt-8 md:from-[8%] md:via-brand-dark/[0.97] md:via-[55%] md:to-transparent md:to-[100%] md:px-10 md:pb-8 md:pt-16 lg:px-12 lg:pb-10 lg:pt-20">
                {/* Mobile: flat on gradient — no large glass box hiding the art */}
                <div className="mx-auto max-w-5xl max-md:space-y-2 md:rounded-[1.75rem] md:border md:border-white/[0.07] md:bg-black/45 md:p-7 md:shadow-[0_16px_48px_rgba(0,0,0,0.55)] md:backdrop-blur-md lg:p-8">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-1 flex min-h-0 items-center gap-1.5 md:mb-4 md:gap-3"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-brand-orange/40 bg-brand-orange/18 md:h-8 md:w-8 md:rounded-xl">
                      <Zap className="h-3 w-3 fill-brand-orange text-brand-orange md:h-4 md:w-4" />
                    </div>
                    <span className="section-kicker !text-[10px] !text-white/75 md:!text-xs md:!text-white/70">{t("trending")}</span>
                  </motion.div>

                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="line-clamp-2 text-sm font-bold leading-snug tracking-tight text-white sm:text-base md:mb-3 md:line-clamp-3 md:text-3xl md:leading-tight lg:line-clamp-3 lg:text-[2.35rem] lg:leading-[1.2]"
                  >
                    {current!.title}
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-2 hidden line-clamp-3 text-sm leading-relaxed text-white/80 md:mb-6 md:block md:min-h-[4.5rem] md:text-base md:leading-relaxed"
                  >
                    {subtitleFor(current!)}
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="mt-2 flex flex-row flex-wrap items-stretch gap-2 md:mt-6 md:items-center md:justify-between md:gap-6"
                  >
                    <Link
                      href={`/product/${current!.id}`}
                      className="inline-flex min-h-0 min-w-0 flex-1 md:w-auto md:max-w-md md:flex-initial"
                    >
                      <span className="inline-flex min-h-10 w-full touch-manipulation items-center justify-center gap-2 rounded-lg bg-brand-orange px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-lg shadow-brand-orange/30 outline-none transition-all hover:bg-brand-orange/92 active:scale-[0.99] md:min-h-12 md:rounded-xl md:px-8 md:text-sm lg:px-10 lg:py-3.5 lg:text-base">
                        <span className="min-w-0 truncate">{t("buyNow")}</span>
                        <span className="shrink-0 text-white/50">|</span>
                        <span className="shrink-0 tabular-nums" dir="ltr" translate="no">
                          {formatPrice(current!.price, locale)}
                        </span>
                      </span>
                    </Link>
                    <div className="hidden min-h-10 min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-black/25 px-2 py-1.5 md:flex md:min-h-0 md:rounded-xl md:border-white/10 md:bg-white/[0.04] md:px-4 md:py-2.5">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] md:h-2 md:w-2"
                        aria-hidden
                      />
                      <span className="text-[9px] font-semibold uppercase leading-tight tracking-wider text-white/90 md:text-xs">
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
              role="tab"
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
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
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
