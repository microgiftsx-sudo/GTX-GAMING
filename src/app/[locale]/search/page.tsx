"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import type { StoreProduct } from '@/lib/store-product';
import CatalogCardImage from '@/components/ui/CatalogCardImage';
import DiscountBadge from '@/components/ui/DiscountBadge';
import { discountBadgeVisible } from '@/lib/store-product';
import { useCart } from '@/context/CartContext';
import SearchSidebar from '@/components/search/SearchSidebar';
import { Link } from '@/i18n/routing';
import { ChevronDown, Filter, LayoutGrid, Loader2, Search as SearchIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sortCatalogItems } from '@/lib/catalog-search-rank';

/** Search grid: 2 cols default, 3 from xl */
const SEARCH_CARD_SIZES = '(max-width: 1279px) 50vw, 33vw';

/**
 * Items per `/api/products` request (must stay constant across pages for Plati/Kinguin).
 * Pagination uses the **server page index**, not `floor(visibleCount / PAGE_SIZE)`, so client-side
 * filters (e.g. accounts title filter) do not repeat page 1.
 */
const PAGE_SIZE = 24;

function mergeDedupeProducts(existing: StoreProduct[], incoming: StoreProduct[]): StoreProduct[] {
  const seen = new Set(existing.map((p) => p.id));
  const out = [...existing];
  for (const p of incoming) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

function buildProductListingQuery(opts: {
  q: string;
  categories: string[];
  platforms: string[];
  minPrice: number;
  maxPrice: number;
  sort: string;
  page: number;
  limit: number;
}): string {
  const sp = new URLSearchParams();
  if (opts.q.trim()) sp.set('q', opts.q.trim());
  if (opts.categories.length) sp.set('category', opts.categories.join(','));
  if (opts.platforms.length) sp.set('platform', opts.platforms.join(','));
  if (opts.minPrice > 0) sp.set('minPrice', String(opts.minPrice));
  if (Number.isFinite(opts.maxPrice) && opts.maxPrice < Number.MAX_SAFE_INTEGER / 4) {
    sp.set('maxPrice', String(opts.maxPrice));
  }
  sp.set('sort', opts.sort);
  sp.set('limit', String(opts.limit));
  sp.set('page', String(opts.page));
  return sp.toString();
}

export default function SearchPage() {
  const t = useTranslations('Search');
  const tp = useTranslations('Product');
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const searchParams = useSearchParams();
  const { addItem, formatPrice } = useCart();

  const [sortBy, setSortBy] = useState('relevance');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [items, setItems] = useState<StoreProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const itemsRef = useRef<StoreProduct[]>([]);
  const totalRef = useRef(0);
  /** Last catalog `page` successfully loaded from `/api/products` (1-based). */
  const lastFetchedPageRef = useRef(0);

  const query = searchParams.get('q') || '';
  /** Stable strings — avoid new [] each render (was retriggering fetch every paint and aborting requests). */
  const categoryParam = searchParams.get('category') ?? '';
  const platformParam = searchParams.get('platform') ?? '';
  const minPriceParam = searchParams.get('minPrice');
  const maxPriceParam = searchParams.get('maxPrice');

  const categories = useMemo(
    () => categoryParam.split(',').filter(Boolean),
    [categoryParam],
  );
  const platforms = useMemo(
    () => platformParam.split(',').filter(Boolean),
    [platformParam],
  );

  const minPrice = Number(minPriceParam) || 0;
  const maxPrice = Number(maxPriceParam) || Infinity;

  const sortKey =
    sortBy === 'price-low'
      ? 'price-low'
      : sortBy === 'price-high'
        ? 'price-high'
        : 'relevance';

  const listingDepsKey = useMemo(
    () =>
      JSON.stringify({
        query,
        categories,
        platforms,
        minPrice,
        maxPrice,
        sortKey,
      }),
    [query, categories, platforms, minPrice, maxPrice, sortKey],
  );

  const listingKeyRef = useRef('');

  itemsRef.current = items;
  totalRef.current = total;

  useEffect(() => {
    const myKey = listingDepsKey;
    listingKeyRef.current = listingDepsKey;
    const ac = new AbortController();
    const qs = buildProductListingQuery({
      q: query,
      categories,
      platforms,
      minPrice,
      maxPrice,
      sort: sortKey,
      page: 1,
      limit: PAGE_SIZE,
    });

    setLoading(true);
    setDidYouMean(null);
    setHasMore(false);
    lastFetchedPageRef.current = 0;
    fetch(`/api/products?${qs}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((data: {
        items?: StoreProduct[];
        total?: number;
        didYouMean?: string;
        listingBatchSize?: number;
      }) => {
        if (listingKeyRef.current !== myKey) return;
        const batch = data.items ?? [];
        const nextTotal = typeof data.total === 'number' ? data.total : 0;
        const sorted = sortCatalogItems(batch, sortKey, query.trim());
        setItems(sorted);
        itemsRef.current = sorted;
        setTotal(nextTotal);
        totalRef.current = nextTotal;
        const hint =
          typeof data.didYouMean === 'string' && data.didYouMean.trim()
            ? data.didYouMean.trim()
            : null;
        setDidYouMean(hint);
        const rawLen =
          typeof data.listingBatchSize === 'number'
            ? data.listingBatchSize
            : batch.length;
        lastFetchedPageRef.current = 1;
        // Full server page ⇒ likely more rows; do not use `sorted.length < total` when totals are API-wide but listing is client-filtered (accounts).
        setHasMore(rawLen === PAGE_SIZE && batch.length > 0);
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          if (listingKeyRef.current !== myKey) return;
          setItems([]);
          itemsRef.current = [];
          setTotal(0);
          totalRef.current = 0;
          setDidYouMean(null);
          setHasMore(false);
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [listingDepsKey, query, sortKey]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const myKey = listingKeyRef.current;
    const prev = itemsRef.current;
    const nextPage = lastFetchedPageRef.current + 1;
    const qs = buildProductListingQuery({
      q: query,
      categories,
      platforms,
      minPrice,
      maxPrice,
      sort: sortKey,
      page: nextPage,
      limit: PAGE_SIZE,
    });

    setLoadingMore(true);
    try {
      const r = await fetch(`/api/products?${qs}`);
      const data: {
        items?: StoreProduct[];
        total?: number;
        listingBatchSize?: number;
      } = await r.json();
      if (listingKeyRef.current !== myKey) return;
      const batch = data.items ?? [];
      if (typeof data.total === 'number') {
        setTotal(data.total);
        totalRef.current = data.total;
      }
      const merged = sortCatalogItems(
        mergeDedupeProducts(prev, batch),
        sortKey,
        query.trim(),
      );
      if (listingKeyRef.current !== myKey) return;
      setItems(merged);
      itemsRef.current = merged;
      const rawLen =
        typeof data.listingBatchSize === 'number'
          ? data.listingBatchSize
          : batch.length;
      lastFetchedPageRef.current = nextPage;
      setHasMore(rawLen === PAGE_SIZE && batch.length > 0);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [listingDepsKey, query, sortKey, loading, loadingMore, hasMore]);

  const countFmt = (n: number) =>
    n.toLocaleString('en-US', { numberingSystem: 'latn' });

  return (
    <div className="min-h-screen pb-20">
      
      {/* Header Info */}
      <div className="bg-surface/90 border-b border-edge py-5 md:py-12 mb-4 md:mb-12 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
            <div className="text-start min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-1 md:mb-4 break-words">
                {query ? (
                  <>
                    {t('resultsFor')}{" "}
                    <span className="text-brand-orange underline underline-offset-8 decoration-4 decoration-brand-orange/30" dir="ltr">
                      &ldquo;{query}&rdquo;
                    </span>
                  </>
                ) : (
                  <span className="text-brand-orange">{t('allProducts')}</span>
                )}
              </h1>
              <div className="mt-1 hidden md:flex flex-col gap-1 text-xs font-medium uppercase tracking-wider text-muted">
                <p className="flex items-center gap-3">
                  <LayoutGrid size={14} className="text-brand-orange shrink-0" />
                  {t('resultsFound', { count: countFmt(total) })}
                </p>
                {!loading && total > 0 && items.length > 0 && (
                  <p className="ps-7 text-[10px] font-semibold normal-case tracking-normal text-faint">
                    {t('showingLoaded', {
                      loaded: countFmt(items.length),
                      total: countFmt(total),
                    })}
                  </p>
                )}
              </div>

              {/* Mobile: compact toolbar (results + filter + sort); category pills hidden — use sidebar filters */}
              <div className="mt-4 space-y-3 md:hidden">
                <div className="flex items-stretch gap-2">
                  <div className="flex-1 min-w-0 self-center text-[11px] font-semibold uppercase tracking-wider text-muted leading-tight">
                    <p>{t('resultsFound', { count: countFmt(total) })}</p>
                    {!loading && total > 0 && items.length > 0 && (
                      <p className="mt-0.5 text-[10px] font-medium normal-case tracking-normal text-faint">
                        {t('showingLoaded', {
                          loaded: countFmt(items.length),
                          total: countFmt(total),
                        })}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMobileFilters(true)}
                    className="shrink-0 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-edge bg-surface-elevated text-brand-orange shadow-sm touch-manipulation"
                    aria-label={t('filters')}
                  >
                    <Filter size={18} />
                  </button>
                  <div className="relative min-w-0 flex-1 max-w-[58%]">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="h-12 w-full appearance-none rounded-xl border border-edge bg-surface-elevated px-3 pe-8 text-[11px] font-semibold uppercase tracking-wide text-foreground focus:outline-none focus:border-brand-orange/45 focus:ring-2 focus:ring-focus-ring touch-manipulation"
                    >
                      <option value="relevance">{t('relevance')}</option>
                      <option value="price-low">{t('priceLowHigh')}</option>
                      <option value="price-high">{t('priceHighLow')}</option>
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  </div>
                </div>
              </div>
            </div>

            {/* Sort — desktop */}
            <div className="relative group hidden w-full md:block md:w-auto">
              <div className="mb-2 flex items-center gap-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
                {t('sortBy')}
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-2xl border border-edge bg-surface-elevated px-6 py-4 text-xs font-semibold uppercase tracking-wider text-foreground outline-none transition-all focus:border-brand-orange/45 focus:outline-none focus:ring-2 focus:ring-focus-ring md:min-w-[240px]"
              >
                <option value="relevance">{t('relevance')}</option>
                <option value="price-low">{t('priceLowHigh')}</option>
                <option value="price-high">{t('priceHighLow')}</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute bottom-5 end-6 text-muted" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 flex flex-col lg:flex-row gap-8 lg:gap-12">
        
        {/* Sidebar - Desktop */}
        <div className="hidden lg:block">
          <SearchSidebar />
        </div>

        {/* Mobile Filter Drawer */}
        <AnimatePresence>
          {showMobileFilters && (
            <motion.div 
              initial={{ opacity: 0, x: isRtl ? 100 : -100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRtl ? 100 : -100 }}
              className="fixed inset-0 z-[100] flex flex-col bg-brand-dark/95 backdrop-blur-xl lg:hidden pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] ps-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))]"
            >
              <div className="flex shrink-0 items-center justify-between mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">{t('filters')}</h2>
                <button
                  type="button"
                  onClick={() => setShowMobileFilters(false)}
                  className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl bg-white/5 touch-manipulation"
                  aria-label={t('closeFilters')}
                >
                  <X size={24} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <SearchSidebar />
              </div>
              <button 
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="mt-6 w-full shrink-0 py-4 min-h-12 bg-brand-orange text-white font-semibold rounded-2xl uppercase tracking-wider shadow-lg shadow-brand-orange/25 touch-manipulation"
              >
                {t('applyFilters')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Grid */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div
              className="flex min-h-[40vh] flex-col items-center justify-center gap-4 py-24 text-center"
              role="status"
              aria-live="polite"
            >
              <Loader2
                className="h-10 w-10 shrink-0 animate-spin text-brand-orange"
                aria-hidden
              />
              <p className="text-sm font-medium text-muted">{t('loadingResults')}</p>
            </div>
          ) : items.length > 0 ? (
            <>
            <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-6 xl:grid-cols-3 md:gap-8 content-below-fold">
              {items.map((product, index) => (
                <div
                  key={product.id}
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
                        sizes={SEARCH_CARD_SIZES}
                        fetchPriority={index < 4 ? 'auto' : 'low'}
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
                          {tp('addToCart')}
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
                      <span className="text-sm font-bold tabular-nums text-brand-blue" lang="en" translate="no">
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
                        {tp('addToCart')}
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
                </div>
              ))}
            </div>
            {hasMore && (
              <div className="mt-10 flex flex-col items-center gap-2 pb-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    void loadMore();
                  }}
                  disabled={loadingMore}
                  className="min-h-12 w-full max-w-sm rounded-2xl border border-edge bg-surface-elevated px-6 py-3 text-xs font-semibold uppercase tracking-wider text-foreground shadow-md transition-colors hover:border-brand-orange/40 hover:text-brand-orange disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
                >
                  {loadingMore ? t('loadingMore') : t('loadMore')}
                </button>
              </div>
            )}
            </>
          ) : (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="py-32 text-center rounded-[3rem] bg-surface-elevated/50 border border-edge border-dashed"
            >
               <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-8 text-white/20">
                 <SearchIcon size={40} />
               </div>
               {query.trim() && didYouMean && (
                 <p className="mx-auto mb-6 max-w-lg px-4 text-base leading-relaxed text-foreground">
                   <span className="font-semibold text-brand-orange">{t('didYouMean')}:</span>{' '}
                   <Link
                     href={`/search?q=${encodeURIComponent(didYouMean)}`}
                     className="font-medium text-brand-blue underline decoration-brand-blue/40 underline-offset-4 hover:text-brand-orange"
                     dir="auto"
                   >
                     {didYouMean}
                   </Link>
                 </p>
               )}
               <h3 className="text-2xl font-bold text-muted mb-2">{t('noResults')}</h3>
               <p className="text-sm text-faint">{t('clearAll')} {t('filters')} {t('sortBy')}</p>
            </motion.div>
          )}
        </div>

      </div>
    </div>
  );
}

const X = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);
