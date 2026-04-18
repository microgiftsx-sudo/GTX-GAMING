"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Globe, ChevronRight, ShoppingCart } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { useParams, notFound } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useTranslations, useLocale } from 'next-intl';
import type { StoreProductDetail } from '@/lib/store-product';
import { discountBadgeVisible } from '@/lib/store-product';
import ProductGallery from '@/components/product/ProductGallery';
import DiscountBadge from '@/components/ui/DiscountBadge';
import SiteLoadingScreen from '@/components/ui/SiteLoadingScreen';

export default function ProductPage() {
  const t = useTranslations('Product');
  const d = useTranslations('Data');
  const ui = useTranslations('UI');
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const { addItem, formatPrice } = useCart();
  const router = useRouter();

  const [product, setProduct] = useState<StoreProductDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadError(false);
    setMissing(false);
    setProduct(null);
    fetch(`/api/products/${id}`)
      .then((r) => {
        if (r.status === 404) {
          setMissing(true);
          return null;
        }
        if (!r.ok) throw new Error('load');
        return r.json() as Promise<StoreProductDetail>;
      })
      .then((p) => {
        if (!cancelled && p) setProduct(p);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

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
      title: product.title,
      price: product.price,
      image: product.image,
      quantity: 1,
    });
  };

  const handleBuyNow = () => {
    if (!product) return;
    addItem({
      id: product.id,
      title: product.title,
      price: product.price,
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

              <hr className="border-edge mb-6 md:mb-8" />

              <div className="flex items-end justify-between mb-6 md:mb-8">
                <div className="flex flex-col w-full items-start rtl:items-end">
                  <div className="flex items-center gap-3 md:gap-4">
                    <span
                      className="text-3xl md:text-4xl font-bold tracking-tight title-gradient leading-none tabular-nums"
                      lang="en"
                      translate="no"
                    >
                      {formatPrice(product.price, locale)}
                    </span>
                    {discountBadgeVisible(product.discount) && (
                      <DiscountBadge variant="inline">{product.discount}</DiscountBadge>
                    )}
                  </div>
                  <div
                    className="text-[10px] md:text-[12px] text-white/20 line-through font-bold mt-1.5 md:mt-2"
                    lang="en"
                    translate="no"
                  >
                    {formatPrice(product.originalPrice, locale)}
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
    </div>
  );
}
