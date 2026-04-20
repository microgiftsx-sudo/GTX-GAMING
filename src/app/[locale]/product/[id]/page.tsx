"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Globe, ChevronRight, ShoppingCart } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { useParams, notFound } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useTranslations, useLocale } from 'next-intl';
import type { StoreProductDetail } from '@/lib/store-product';
import { discountBadgeVisible } from '@/lib/store-product';
import { eurToIqd } from '@/lib/currency';
import { applyTaxToBaseIqd } from '@/lib/tax-math';
import ProductGallery from '@/components/product/ProductGallery';
import DiscountBadge from '@/components/ui/DiscountBadge';
import SiteLoadingScreen from '@/components/ui/SiteLoadingScreen';
import LazyWhenVisible from '@/components/ui/LazyWhenVisible';
import ProductRelatedSection from '@/components/product/ProductRelatedSection';

type KinguinVariantDto = { id: string; label: string; priceEur: number };

type ProductApiDetail = StoreProductDetail & {
  catalogSource?: 'kinguin' | 'plati';
  platiOptionGroups?: StoreProductDetail['platiOptionGroups'];
  platiSelections?: { optionId: number; valueId: number }[];
  kinguinPriceVariants?: KinguinVariantDto[];
};

function platiSelectionsToRecord(
  rows: { optionId: number; valueId: number }[] | undefined,
): Record<number, number> {
  const m: Record<number, number> = {};
  if (!rows) return m;
  for (const r of rows) m[r.optionId] = r.valueId;
  return m;
}

function recordToSelectionBody(sel: Record<number, number>): { optionId: number; valueId: number }[] {
  return Object.entries(sel).map(([k, v]) => ({ optionId: Number(k), valueId: v }));
}

function platiVariantLabel(
  groups: NonNullable<ProductApiDetail['platiOptionGroups']>,
  sel: Record<number, number>,
): string | undefined {
  const parts: string[] = [];
  for (const g of groups) {
    const vid = sel[g.optionId];
    const c = g.choices.find((x) => x.valueId === vid);
    if (c) parts.push(c.label);
  }
  return parts.length ? parts.join(' · ') : undefined;
}

function buildPlatiCartKey(productId: string, sel: Record<number, number>): string {
  const body = recordToSelectionBody(sel)
    .sort((a, b) => a.optionId - b.optionId)
    .map((x) => `${x.optionId}:${x.valueId}`)
    .join('|');
  return `plati:${productId}:${body}`;
}

export default function ProductPage() {
  const t = useTranslations('Product');
  const d = useTranslations('Data');
  const ui = useTranslations('UI');
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const { addItem, formatPrice, taxRatePercent } = useCart();
  const router = useRouter();

  const [product, setProduct] = useState<ProductApiDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [missing, setMissing] = useState(false);
  const [platiSel, setPlatiSel] = useState<Record<number, number>>({});
  const [kinguinVarId, setKinguinVarId] = useState<string | null>(null);
  const [livePlatiGross, setLivePlatiGross] = useState<number | null>(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const calcAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadError(false);
    setMissing(false);
    setProduct(null);
    setPlatiSel({});
    setKinguinVarId(null);
    setLivePlatiGross(null);
    fetch(`/api/products/${id}`)
      .then((r) => {
        if (r.status === 404) {
          setMissing(true);
          return null;
        }
        if (!r.ok) throw new Error('load');
        return r.json() as Promise<ProductApiDetail>;
      })
      .then((p) => {
        if (cancelled || !p) return;
        setProduct(p);
        if (p.catalogSource === 'plati' && p.platiSelections?.length) {
          setPlatiSel(platiSelectionsToRecord(p.platiSelections));
        }
        if (p.catalogSource === 'kinguin' && p.kinguinPriceVariants?.length) {
          setKinguinVarId(p.kinguinPriceVariants[0]!.id);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!product || product.catalogSource !== 'plati') return;
    if (!product.platiOptionGroups?.length) {
      setLivePlatiGross(null);
      return;
    }
    const keys = Object.keys(platiSel);
    if (keys.length === 0) return;

    calcAbort.current?.abort();
    const ac = new AbortController();
    calcAbort.current = ac;
    setPriceBusy(true);

    const tmr = window.setTimeout(() => {
      fetch(`/api/products/${id}/calc-price`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ selections: recordToSelectionBody(platiSel) }),
        signal: ac.signal,
      })
        .then(async (r) => {
          if (!r.ok) throw new Error('calc');
          return r.json() as Promise<{ price?: number }>;
        })
        .then((j) => {
          if (ac.signal.aborted) return;
          if (typeof j.price === 'number' && Number.isFinite(j.price)) {
            setLivePlatiGross(j.price);
          }
        })
        .catch(() => {
          if (!ac.signal.aborted) setLivePlatiGross(null);
        })
        .finally(() => {
          if (!ac.signal.aborted) setPriceBusy(false);
        });
    }, 180);

    return () => {
      window.clearTimeout(tmr);
      ac.abort();
    };
  }, [product, platiSel, id]);

  const effectiveGrossPrice = useMemo(() => {
    if (!product) return 0;
    if (product.catalogSource === 'plati' && livePlatiGross != null) return livePlatiGross;
    if (product.catalogSource === 'kinguin' && product.kinguinPriceVariants?.length && kinguinVarId) {
      const v = product.kinguinPriceVariants.find((x) => x.id === kinguinVarId);
      if (v) return applyTaxToBaseIqd(Math.round(eurToIqd(v.priceEur)), taxRatePercent);
    }
    return product.price;
  }, [product, livePlatiGross, kinguinVarId, taxRatePercent]);

  const variantLabelForCart = useCallback((): string | undefined => {
    if (!product) return undefined;
    if (product.catalogSource === 'plati' && product.platiOptionGroups?.length) {
      return platiVariantLabel(product.platiOptionGroups, platiSel);
    }
    if (product.catalogSource === 'kinguin' && product.kinguinPriceVariants?.length && kinguinVarId) {
      return product.kinguinPriceVariants.find((x) => x.id === kinguinVarId)?.label;
    }
    return undefined;
  }, [product, platiSel, kinguinVarId]);

  const cartTitle = useCallback(() => {
    if (!product) return '';
    const v = variantLabelForCart();
    return v ? `${product.title} — ${v}` : product.title;
  }, [product, variantLabelForCart]);

  const cartKeyForLine = useCallback(() => {
    if (!product) return '';
    if (product.catalogSource === 'plati' && product.platiOptionGroups?.length) {
      return buildPlatiCartKey(product.id, platiSel);
    }
    if (product.catalogSource === 'kinguin' && kinguinVarId) {
      return `kinguin:${product.id}:${kinguinVarId}`;
    }
    return String(product.id);
  }, [product, platiSel, kinguinVarId]);

  if (missing) {
    notFound();
  }

  const getPlatformName = (p: string) => {
    return d(`categories.${p}`);
  };

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      id: product.id,
      cartKey: cartKeyForLine(),
      title: cartTitle(),
      price: effectiveGrossPrice,
      image: product.image,
      quantity: 1,
    });
  };

  const handleBuyNow = () => {
    if (!product) return;
    addItem({
      id: product.id,
      cartKey: cartKeyForLine(),
      title: cartTitle(),
      price: effectiveGrossPrice,
      image: product.image,
      quantity: 1,
    });
    router.push('/checkout');
  };

  if (loadError) {
    return (
      <div className="min-h-screen pb-20 flex items-center justify-center px-4 text-center text-muted text-sm">
        {ui('noResults')}
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-[min(50vh,480px)] w-full items-center justify-center px-4 pb-20 pt-8">
        <SiteLoadingScreen />
      </div>
    );
  }

  const platformName = getPlatformName(product.platform);
  const description = product.description?.trim() || '';
  const showVariantUi =
    (product.platiOptionGroups && product.platiOptionGroups.length > 0) ||
    (product.kinguinPriceVariants && product.kinguinPriceVariants.length > 1);

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-6 flex items-center gap-1.5 md:gap-2 text-[9px] md:text-xs font-medium text-muted uppercase tracking-wider overflow-hidden whitespace-nowrap">
        <Link href="/" className="hover:text-brand-orange shrink-0">
          {t('store')}
        </Link>
        <ChevronRight size={10} className="rtl:rotate-180 md:size-[12px] shrink-0" />
        <span className="text-foreground/70 truncate max-w-[80px] md:max-w-none">{platformName}</span>
        <ChevronRight size={10} className="rtl:rotate-180 md:size-[12px] shrink-0" />
        <span className="text-white truncate">{product.title}</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
        <div className="lg:col-span-8 space-y-6 md:space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ProductGallery
              title={product.title}
              galleryUrls={product.galleryUrls?.length ? product.galleryUrls : [product.image]}
              youtubeIds={product.youtubeIds ?? []}
            />
          </motion.div>

          <section className="card-surface p-6 md:p-8 backdrop-blur-sm text-start">
            <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground mb-4 md:mb-6">
              {t('descriptionLabel').split(' ')[0]}{' '}
              <span className="text-brand-orange font-semibold">
                {t('descriptionLabel').split(' ').slice(1).join(' ')}
              </span>
            </h2>
            <div className="prose prose-invert max-w-none text-muted leading-relaxed text-xs md:text-sm">
              {description ? <p>{description}</p> : <p className="text-muted/60">{product.title}</p>}
            </div>
          </section>
        </div>

        <div className="lg:col-span-4 relative">
          <div className="sticky top-28 space-y-4 md:space-y-6">
            <motion.div
              initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-surface-elevated border border-edge rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-[0_40px_80px_rgba(0,0,0,0.45)] relative overflow-hidden text-start ring-1 ring-white/[0.04]"
            >
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight text-foreground mb-4 md:mb-6">
                {product.title}
              </h1>

              <div className="space-y-3 md:space-y-4 mb-6 md:mb-8">
                <div className="flex items-center justify-between text-[10px] md:text-xs font-medium text-muted uppercase tracking-wider">
                  <span>{t('platform')}</span>
                  <span className="text-white/80">{platformName}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] md:text-xs font-medium text-muted uppercase tracking-wider">
                  <span>{t('region')}</span>
                  <div className="flex items-center gap-2 text-brand-blue">
                    <Globe size={12} className="md:size-[14px]" />
                    <span>{product.region === 'global' ? t('global') : product.region.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              {showVariantUi && (
                <div className="mb-6 md:mb-8 space-y-5">
                  {product.platiOptionGroups?.map((group) => (
                    <div key={group.optionId} className="space-y-2">
                      <p className="text-[10px] md:text-xs font-semibold text-muted uppercase tracking-wider">
                        {group.label}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.choices.map((c) => {
                          const active = platiSel[group.optionId] === c.valueId;
                          return (
                            <button
                              key={c.valueId}
                              type="button"
                              onClick={() =>
                                setPlatiSel((prev) => ({ ...prev, [group.optionId]: c.valueId }))
                              }
                              className={`rounded-xl border px-3 py-2 text-left text-[11px] md:text-xs font-medium transition-colors outline-none max-w-full ${
                                active
                                  ? 'border-brand-orange bg-brand-orange/10 text-foreground'
                                  : 'border-edge text-muted hover:border-white/20 hover:text-foreground'
                              }`}
                            >
                              {c.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {product.kinguinPriceVariants && product.kinguinPriceVariants.length > 1 && (
                    <div className="space-y-2">
                      <p className="text-[10px] md:text-xs font-semibold text-muted uppercase tracking-wider">
                        {t('priceOption')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {product.kinguinPriceVariants.map((c) => {
                          const active = kinguinVarId === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setKinguinVarId(c.id)}
                              className={`rounded-xl border px-3 py-2 text-left text-[11px] md:text-xs font-medium transition-colors outline-none max-w-full ${
                                active
                                  ? 'border-brand-orange bg-brand-orange/10 text-foreground'
                                  : 'border-edge text-muted hover:border-white/20 hover:text-foreground'
                              }`}
                            >
                              {c.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {product.catalogSource === 'plati' && priceBusy && (
                    <p className="text-[10px] text-muted">{t('priceUpdating')}</p>
                  )}
                </div>
              )}

              <hr className="border-edge mb-6 md:mb-8" />

              <div className="flex items-end justify-between mb-6 md:mb-8">
                <div className="flex flex-col w-full items-start rtl:items-end">
                  <div className="flex items-center gap-3 md:gap-4">
                    <span
                      className="text-3xl md:text-4xl font-bold tracking-tight title-gradient leading-none tabular-nums"
                      lang="en"
                      translate="no"
                    >
                      {formatPrice(effectiveGrossPrice, locale)}
                    </span>
                    {!showVariantUi && discountBadgeVisible(product.discount) && (
                      <DiscountBadge variant="inline">{product.discount}</DiscountBadge>
                    )}
                  </div>
                  <div
                    className="text-[10px] md:text-[12px] text-white/20 line-through font-bold mt-1.5 md:mt-2"
                    lang="en"
                    translate="no"
                  >
                    {!showVariantUi ? formatPrice(product.originalPrice, locale) : '\u00a0'}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full flex items-center justify-center gap-3 py-4 md:py-5 bg-brand-orange text-white font-semibold rounded-xl md:rounded-2xl shadow-lg shadow-brand-orange/25 hover:bg-brand-orange/90 active:scale-95 transition-all text-base md:text-lg outline-none uppercase tracking-wider"
                >
                  <ShoppingCart size={18} className="md:size-[20px]" />
                  {t('addToCart')}
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="w-full block text-center py-3.5 md:py-4 border border-edge text-muted font-semibold rounded-xl md:rounded-2xl hover:bg-white/5 hover:text-foreground transition-all text-xs md:text-sm uppercase tracking-wider outline-none"
                >
                  {t('buyNow')}
                </button>
              </div>
            </motion.div>

            <div className="card-surface p-4 md:p-6">
              <div className="flex items-center gap-3 md:gap-4 text-start">
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-brand-blue/20 flex items-center justify-center text-brand-blue shrink-0">
                  <ShieldCheck size={18} className="md:size-[20px]" />
                </div>
                <div>
                  <p className="text-[10px] md:text-xs font-semibold text-foreground tracking-tight">{t('protection')}</p>
                  <p className="text-[8px] md:text-[10px] text-muted uppercase font-medium tracking-wider">{t('verified')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <LazyWhenVisible
        minHeight="min-h-[280px] md:min-h-[240px]"
        rootMargin="120px 0px"
        className="max-w-7xl mx-auto px-4"
      >
        <ProductRelatedSection current={product} />
      </LazyWhenVisible>
    </div>
  );
}
