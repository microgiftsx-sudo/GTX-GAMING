"use client";

import React, { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Checkbox from '@/components/ui/Checkbox';

interface FilterSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const FilterSection = ({ title, isOpen, onToggle, children }: FilterSectionProps) => (
  <div className="border-b border-edge py-4">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between text-sm sm:text-[15px] font-semibold uppercase tracking-[0.08em] text-muted hover:text-foreground transition-colors mb-2"
    >
      <span>{title}</span>
      <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="pt-2 space-y-2">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export default function SearchSidebar() {
  const t = useTranslations('Search');
  const d = useTranslations('Data');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [openSections, setOpenSections] = useState({
    type: true,
    platform: true,
    region: true,
    price: true
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateFilter = (key: string, value: string, isChecked: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    const currentValues = params.get(key)?.split(',') || [];

    if (isChecked) {
      params.set(key, [...currentValues, value].join(','));
    } else {
      const remaining = currentValues.filter(v => v !== value);
      if (remaining.length) params.set(key, remaining.join(','));
      else params.delete(key);
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePriceChange = (type: 'min' | 'max', value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(type === 'min' ? 'minPrice' : 'maxPrice', value);
    else params.delete(type === 'min' ? 'minPrice' : 'maxPrice');
    router.push(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () => {
    const params = new URLSearchParams();
    const q = searchParams.get('q');
    if (q) params.set('q', q);
    router.push(`${pathname}?${params.toString()}`);
  };

  const isChecked = (key: string, value: string) => {
    return searchParams.get(key)?.split(',').includes(value) || false;
  };

  return (
    <div className="w-full lg:w-72 shrink-0 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base sm:text-lg font-bold uppercase tracking-[0.1em] text-brand-orange">{t('filters')}</h2>
        <button
          type="button"
          onClick={clearFilters}
          className="text-xs sm:text-sm font-medium text-muted hover:text-foreground transition-colors uppercase tracking-[0.08em] underline-offset-2 hover:underline"
        >
          {t('clearAll')}
        </button>
      </div>

      <div className="card-surface rounded-3xl p-6 backdrop-blur-sm">

        <FilterSection
          title={t('productType')}
          isOpen={openSections.type}
          onToggle={() => toggleSection('type')}
        >
          {['games', 'cards', 'software', 'dlc', 'accounts'].map(item => (
            <Checkbox
              key={item}
              checked={isChecked('category', item)}
              onChange={(checked) => updateFilter('category', item, checked)}
              label={d(`categories.${item}`)}
            />
          ))}
        </FilterSection>

        {/* Platform - Label Removed as requested */}
        <div className="pt-2 pb-4 border-b border-edge space-y-2">
          {['steam', 'psn', 'xbox', 'pc'].map(item => (
            <Checkbox
              key={item}
              checked={isChecked('platform', item)}
              onChange={(checked) => updateFilter('platform', item, checked)}
              label={item === 'psn' ? 'PlayStation' : item}
            />
          ))}
        </div>

        {/* Region */}
        <FilterSection
          title={t('regionLabel')}
          isOpen={openSections.region}
          onToggle={() => toggleSection('region')}
        >
          {['global', 'iq', 'us', 'eu'].map(item => (
            <Checkbox
              key={item}
              checked={isChecked('region', item)}
              onChange={(checked) => updateFilter('region', item, checked)}
              label={item === 'global' ? t('global') : item}
            />
          ))}
        </FilterSection>

        {/* Price Range */}
        <FilterSection
          title={t('priceRange')}
          isOpen={openSections.price}
          onToggle={() => toggleSection('price')}
        >
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="space-y-1">
              <span className="text-xs sm:text-sm font-semibold text-faint uppercase tracking-[0.08em]">{t('minPrice')}</span>
              <input
                type="number"
                placeholder="0"
                lang="en"
                translate="no"
                dir="ltr"
                value={searchParams.get('minPrice') || ''}
                onChange={(e) => handlePriceChange('min', e.target.value)}
                className="w-full bg-surface border border-edge rounded-xl px-3 py-2.5 text-sm sm:text-[15px] text-foreground focus:outline-none focus:border-brand-orange/45 focus:ring-2 focus:ring-focus-ring transition-all font-medium"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs sm:text-sm font-semibold text-faint uppercase tracking-[0.08em]">{t('maxPrice')}</span>
              <input
                type="text"
                placeholder="∞"
                lang="en"
                translate="no"
                dir="ltr"
                value={searchParams.get('maxPrice') || ''}
                onChange={(e) => handlePriceChange('max', e.target.value)}
                className="w-full bg-surface border border-edge rounded-xl px-3 py-2.5 text-sm sm:text-[15px] text-foreground focus:outline-none focus:border-brand-orange/45 focus:ring-2 focus:ring-focus-ring transition-all font-medium"
              />
            </div>
          </div>
        </FilterSection>

      </div>
    </div>
  );
}
