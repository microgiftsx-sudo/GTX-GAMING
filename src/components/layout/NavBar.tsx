"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ChevronDown, Zap, Monitor, Laptop, Gift, Crown } from 'lucide-react';

const CATEGORIES = [
  { name: 'games', key: 'games', icon: <Zap size={16} /> },
  { name: 'cards', key: 'cards', icon: <Gift size={16} /> },
  { name: 'psn', key: 'psn', icon: <Crown size={16} /> },
  { name: 'xbox', key: 'xbox', icon: <Monitor size={16} /> },
  { name: 'software', key: 'software', icon: <Laptop size={16} /> },
] as const;

function categorySearchHref(key: (typeof CATEGORIES)[number]['key']): string {
  switch (key) {
    case 'games':
      return '/search?category=games';
    case 'cards':
      return '/search?category=cards';
    case 'software':
      return '/search?category=software';
    case 'psn':
      return '/search?platform=psn';
    case 'xbox':
      return '/search?platform=xbox';
    default:
      return '/search';
  }
}

export default function NavBar() {
  const t = useTranslations('Header');

  return (
    <nav className="relative z-[45] border-b border-edge bg-brand-dark/40 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 lg:gap-8 lg:py-3">
        {CATEGORIES.map((cat) => {
          const href = categorySearchHref(cat.key);
          return (
            <div key={cat.name} className="group relative shrink-0">
              <Link
                href={href}
                className="flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground transition-colors py-2 min-h-11 lg:min-h-0 lg:py-2 whitespace-nowrap touch-manipulation relative after:absolute after:bottom-1 after:start-0 after:h-0.5 after:w-full after:rounded-full after:bg-brand-orange after:origin-center after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-200"
              >
                <span className="text-brand-orange/50 group-hover:text-brand-orange transition-colors">
                  {cat.icon}
                </span>
                {t(`categories.${cat.key}`)}
                <ChevronDown
                  size={14}
                  className="hidden lg:inline opacity-60 group-hover:rotate-180 transition-transform duration-300"
                />
              </Link>

              <div
                className="invisible absolute top-full z-50 mt-1 hidden w-48 translate-y-2 rounded-xl border border-edge bg-surface-elevated p-2 opacity-0 shadow-xl shadow-black/30 ring-1 ring-white/[0.04] transition-all duration-300 ltr:left-0 rtl:right-0 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 lg:block"
              >
                <Link
                  href={href}
                  className="block px-3 py-2 text-xs font-medium text-muted hover:text-foreground hover:bg-white/5 rounded-lg transition-all"
                >
                  {t('latest')}
                </Link>
                <Link
                  href={href}
                  className="block px-3 py-2 text-xs font-medium text-muted hover:text-foreground hover:bg-white/5 rounded-lg transition-all"
                >
                  {t('top')}
                </Link>
                <Link
                  href={href}
                  className="block px-3 py-2 text-xs font-medium text-muted hover:text-foreground hover:bg-white/5 rounded-lg transition-all"
                >
                  {t('sale')}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
