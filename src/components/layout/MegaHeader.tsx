"use client";

import React, { useState, useEffect } from 'react';
import { Search, Globe, ShoppingCart, ChevronDown, X, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { useLocale, useTranslations } from 'next-intl';

import { routing } from '@/i18n/routing';
import type { StoreProduct } from '@/lib/store-product';
import CurrencyFlag from '@/components/ui/CurrencyFlag';

type AppLocale = (typeof routing.locales)[number];

export default function MegaHeader() {
  const t = useTranslations('Header');
  const d = useTranslations('Data');
  const ui = useTranslations('UI');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { itemCount, currency, setCurrency, formatPrice } = useCart();
  
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [langDropdown, setLangDropdown] = useState(false);
  const [currDropdown, setCurrDropdown] = useState(false);
  const [headerHits, setHeaderHits] = useState<StoreProduct[]>([]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setHeaderHits([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/products?q=${encodeURIComponent(q)}&limit=5`)
        .then((r) => r.json())
        .then((data: { items?: StoreProduct[] }) => setHeaderHits(data.items ?? []))
        .catch(() => setHeaderHits([]));
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchFocused(false);
    }
  };

  const handleTrendingSearch = (query: string) => {
    const q = query.trim();
    if (!q) return;
    setSearchQuery(q);
    setSearchFocused(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const toggleLanguage = (newLocale: AppLocale) => {
    router.replace(pathname, { locale: newLocale });
    setLangDropdown(false);
  };

  const controlBtnBase =
    'flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-2 py-2 transition-all touch-manipulation sm:gap-2 sm:px-3 md:min-h-0 md:py-2';

  return (
    <header className="bg-brand-dark/75 backdrop-blur-xl border-b border-edge sticky top-0 z-50 w-full shadow-[0_8px_32px_rgba(0,0,0,0.35)] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto] gap-x-2 gap-y-3 px-3 py-3 sm:px-4 md:h-20 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-x-8 md:gap-y-0 md:py-0">
        {/* Logo */}
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2 justify-self-start md:col-start-1 md:row-start-1"
        >
          <img
            src="/icons/logo.png"
            alt="GTX Gaming Logo"
            className="h-11 w-11 rounded-xl object-cover transition-transform duration-300 group-hover:scale-105 md:h-12 md:w-12"
            loading="eager"
            decoding="async"
          />
          <span className="hidden text-xl font-bold uppercase tracking-tight title-gradient md:block md:text-2xl">
            GTX GAMING
          </span>
        </Link>

        {/* Lang + currency + cart — same pattern as desktop on all breakpoints */}
        <div className="relative z-[60] col-start-2 row-start-1 flex items-center justify-end gap-1.5 sm:gap-2 md:col-start-3 md:gap-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setLangDropdown(!langDropdown);
                setCurrDropdown(false);
              }}
              className={`${controlBtnBase} ${
                langDropdown
                  ? 'border-white/20 bg-white/10'
                  : 'border-transparent hover:border-white/10 hover:bg-white/5'
              }`}
            >
              <Globe className="h-4 w-4 shrink-0 text-brand-blue sm:h-5 sm:w-5" />
              <span className="max-w-[4.5rem] truncate text-[11px] font-bold uppercase sm:max-w-none sm:text-sm">
                {t(`languages.${locale}`)}
              </span>
            </button>
            <AnimatePresence>
              {langDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute end-0 top-full z-[70] mt-2 min-w-[120px] rounded-xl border border-edge bg-surface-elevated p-2 shadow-xl"
                >
                  <button
                    type="button"
                    onClick={() => toggleLanguage('ar')}
                    className={`w-full rounded-lg px-4 py-2 text-start text-xs font-bold transition-colors ${
                      locale === 'ar'
                        ? 'bg-brand-orange text-white'
                        : 'text-white/40 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {t('languages.ar')}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleLanguage('en')}
                    className={`w-full rounded-lg px-4 py-2 text-start text-xs font-bold transition-colors ${
                      locale === 'en'
                        ? 'bg-brand-orange text-white'
                        : 'text-white/40 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {t('languages.en')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setCurrDropdown(!currDropdown);
                setLangDropdown(false);
              }}
              className={`${controlBtnBase} ${
                currDropdown
                  ? 'border-white/20 bg-white/10'
                  : 'border-transparent hover:border-white/10 hover:bg-white/5'
              }`}
            >
              <CurrencyFlag code={currency} size="sm" className="sm:text-lg" />
              <span className="max-w-[3.25rem] truncate text-[11px] font-bold tracking-tight sm:max-w-none sm:text-sm">
                {t(`currencies.${currency}`)}
              </span>
            </button>
            <AnimatePresence>
              {currDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute end-0 top-full z-[70] mt-2 min-w-[100px] rounded-xl border border-edge bg-surface-elevated p-2 shadow-xl"
                >
                  {['IQD', 'USD', 'EUR'].map((currCode) => (
                    <button
                      type="button"
                      key={currCode}
                      onClick={() => {
                        setCurrency(currCode);
                        setCurrDropdown(false);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-xs font-bold transition-colors ${
                        currency === currCode
                          ? 'bg-brand-orange text-white'
                          : 'text-white/40 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <CurrencyFlag code={currCode} size="md" />
                      <span>{t(`currencies.${currCode}`)}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link
            href="/cart"
            className="group relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-edge bg-surface-elevated p-2.5 shadow-sm shadow-black/20 transition-all hover:border-brand-orange/30 hover:bg-brand-orange/10 md:p-3 touch-manipulation"
          >
            <ShoppingCart className="h-5 w-5 text-white transition-colors group-hover:text-brand-orange" />
            {itemCount > 0 && (
              <span
                className="absolute -end-1 -top-1 flex h-4 w-4 items-center justify-center rounded-md border border-brand-dark bg-brand-purple text-[8px] font-bold text-white md:h-5 md:w-5 md:rounded-lg md:text-[10px] md:ring-2 md:ring-brand-dark"
                dir="ltr"
                lang="en"
                translate="no"
              >
                {itemCount.toLocaleString('en-US', { numberingSystem: 'latn' })}
              </span>
            )}
          </Link>
        </div>

        {/* Search Bar */}
        <div className="group relative z-10 col-span-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1 md:max-w-2xl">
          <form onSubmit={handleSearchSubmit} className={`relative flex items-center transition-all duration-300 ${searchFocused ? 'md:scale-[1.02]' : ''}`}>
            <Search className="absolute start-4 text-muted w-4 h-4 md:w-5 md:h-5 pointer-events-none" />
            <input 
              type="search"
              enterKeyHint="search"
              placeholder={t('search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              className={`w-full bg-surface-elevated border border-edge rounded-xl md:rounded-2xl py-3 min-h-[48px] md:min-h-0 md:py-3 ps-10 md:ps-12 text-base text-foreground placeholder:text-faint focus:outline-none focus:border-brand-orange/45 focus:ring-2 focus:ring-focus-ring shadow-lg shadow-black/30 transition-all ${searchQuery ? 'pe-12' : 'pe-4'}`}
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="absolute end-2 top-1/2 -translate-y-1/2 min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg text-faint hover:text-foreground touch-manipulation"
              >
                <X size={16} />
              </button>
            )}
          </form>

          <AnimatePresence>
            {searchFocused && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-3 p-4 bg-surface-elevated border border-edge rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.45)] z-[60] ring-1 ring-white/[0.04]"
              >
                {!searchQuery ? (
                  <>
                    <p className="section-kicker text-white/50 mb-3 px-2 flex items-center gap-2">
                       <TrendingUp size={12} className="text-brand-orange" />
                       {t('trending')}
                    </p>
                    <div className="space-y-1">
                      {[
                        { key: 'ps', label: t('trendingGames.ps'), query: 'playstation' },
                        { key: 'steam', label: t('trendingGames.steam'), query: 'steam' },
                        { key: 'xbox', label: t('trendingGames.xbox'), query: 'xbox' }
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleTrendingSearch(item.query)}
                          className="w-full text-start px-3 py-2.5 rounded-xl hover:bg-white/5 text-white/70 hover:text-brand-orange transition-colors flex items-center justify-between group outline-none"
                        >
                          <span className="text-xs md:text-sm font-bold">{item.label}</span>
                          <ChevronDown className="w-4 h-4 -rotate-90 rtl:rotate-90 opacity-30 group-hover:opacity-100 transition-all" />
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    {headerHits.length > 0 ? (
                      headerHits.map((result) => (
                        <Link 
                          key={result.id}
                          href={`/product/${result.id}`}
                          className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 group border border-transparent hover:border-white/5 transition-all outline-none"
                        >
                          <div className="flex flex-col text-start">
                            <span className="text-xs md:text-sm font-semibold text-foreground group-hover:text-brand-orange transition-colors">
                              {result.title}
                            </span>
                            <span className="text-[9px] md:text-[10px] text-muted uppercase font-medium">
                              {d(`categories.${result.platform}`)}
                            </span>
                          </div>
                          <span className="text-xs md:text-sm font-bold text-brand-blue tabular-nums" lang="en" translate="no">{formatPrice(result.price, locale)}</span>
                        </Link>
                      ))
                    ) : (
                      <div className="py-8 text-center text-muted text-xs md:text-sm">
                         {ui('noResults')}{" "}
                         <span dir="ltr">&ldquo;{searchQuery}&rdquo;</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </header>
  );
}
