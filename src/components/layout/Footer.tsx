"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { Camera, Gamepad2, Send } from 'lucide-react';
import { Link } from '@/i18n/routing';

export default function Footer() {
  const t = useTranslations('Footer');
  const d = useTranslations('Data');

  const socialLinks = [
    { icon: <Camera size={20} />, href: "#", label: "Instagram" },
    { icon: <Gamepad2 size={20} />, href: "#", label: "Discord" },
    { icon: <Send size={20} />, href: "#", label: "Telegram" },
  ];

  const paymentMethods = [
    { name: d('methods.fib'), icon: '/icons/firstbank.png' },
    { name: d('methods.zain'), icon: '/icons/zaincash.png' },
    { name: d('methods.qi'), icon: '/icons/superqi.png' },
    { name: d('methods.fastpay'), icon: '/icons/fastpay.png' },
  ];

  const linkClass =
    "text-muted hover:text-brand-orange transition-colors text-sm py-2.5 -my-1 min-h-11 inline-flex items-center touch-manipulation";

  return (
    <footer className="mt-auto bg-brand-dark/80 border-t border-edge pt-10 md:pt-16 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:pb-10 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4 lg:gap-10 mb-10 md:mb-14">
          {/* Brand */}
          <div className="space-y-4 text-start lg:max-w-sm">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 shrink-0 bg-brand-orange rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-brand-orange/20">
                GTX
              </div>
              <span className="text-xl sm:text-2xl font-bold text-white tracking-tight title-gradient uppercase">
                GAMING
              </span>
            </div>
            <p className="text-muted leading-relaxed text-sm">
              {t('about')}
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {socialLinks.map((social, idx) => (
                <a 
                  key={idx} 
                  href={social.href}
                  className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl bg-white/5 text-muted hover:bg-brand-orange hover:text-white transition-colors shadow-lg shadow-black/20 touch-manipulation"
                  aria-label={social.label}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Shop + Help: جنباً إلى جنب على الجوال لتقليل الطول */}
          <div className="grid grid-cols-2 gap-6 sm:gap-8 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-10">
            <div className="space-y-3 text-start min-w-0">
              <h4 className="text-foreground font-semibold text-xs uppercase tracking-wider border-b border-edge pb-2 mb-1">
                {t('shop')}
              </h4>
              <ul className="space-y-0">
                <li><Link href="#" className={linkClass}>{t('games')}</Link></li>
                <li><Link href="#" className={linkClass}>{t('cards')}</Link></li>
                <li><Link href="#" className={linkClass}>{t('software')}</Link></li>
              </ul>
            </div>

            <div className="space-y-3 text-start min-w-0">
              <h4 className="text-foreground font-semibold text-xs uppercase tracking-wider border-b border-edge pb-2 mb-1">
                {t('help')}
              </h4>
              <ul className="space-y-0">
                <li><Link href="#" className={linkClass}>{t('contact')}</Link></li>
                <li><Link href="#" className={linkClass}>{t('faq')}</Link></li>
                <li><Link href="#" className={linkClass}>{t('guarantee')}</Link></li>
              </ul>
            </div>
          </div>

          {/* Payments */}
          <div className="space-y-3 text-start">
            <h4 className="text-foreground font-semibold text-xs uppercase tracking-wider border-b border-edge pb-2 mb-2 lg:border-0 lg:pb-0">
              {t('payments')}
            </h4>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {paymentMethods.map((method, idx) => (
                <div 
                  key={idx}
                  className="bg-surface-elevated border border-edge rounded-xl px-2.5 py-2.5 sm:px-3 flex items-center gap-2.5 min-h-[2.9rem] pointer-events-none"
                >
                  <div className="h-7 w-7 shrink-0 rounded-md bg-white/95 ring-1 ring-white/25 flex items-center justify-center p-1">
                    <img
                      src={method.icon}
                      alt={method.name}
                      className="h-full w-full object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <span className="text-[11px] sm:text-xs font-semibold text-white/90 leading-tight line-clamp-2">
                    {method.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-edge pt-6 md:pt-8 flex flex-col items-center text-center gap-4 md:flex-row md:justify-between md:items-center md:text-start">
          <div className="text-muted text-xs leading-relaxed max-w-[22rem] md:max-w-none">
            © {new Date().getFullYear()} GTX GAMING. {t('rights')}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
             <Link href="#" className="text-muted hover:text-foreground transition-colors text-xs font-medium min-h-11 inline-flex items-center touch-manipulation">
               {t('privacy')}
             </Link>
             <Link href="#" className="text-muted hover:text-foreground transition-colors text-xs font-medium min-h-11 inline-flex items-center touch-manipulation">
               {t('terms')}
             </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
