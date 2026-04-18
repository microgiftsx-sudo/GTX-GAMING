"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Trash2, ArrowRight, Tag, ShieldCheck, ArrowLeft, Plus, Minus } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useCart } from '@/context/CartContext';
import { useTranslations, useLocale } from 'next-intl';

export default function CartPage() {
  const t = useTranslations('Cart');
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const { cart, removeItem, updateQuantity, subtotal, itemCount, formatPrice } = useCart();
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);

  const discountAmount = discountApplied ? subtotal * 0.1 : 0; // 10% mock discount
  const total = subtotal - discountAmount;

  if (itemCount === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-24 h-24 bg-surface-elevated rounded-full flex items-center justify-center mb-8 border border-edge">
          <ShoppingCart size={40} className="text-white/20" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4 text-start">
          {t('title')} <span className="text-brand-orange font-semibold">{t('empty')}</span>
        </h2>
        <p className="text-muted mb-8 max-w-md text-start">{t('emptyDescription')}</p>
        <Link href="/" className="px-8 py-4 bg-brand-orange text-white font-semibold rounded-2xl shadow-lg shadow-brand-orange/25 hover:bg-brand-orange/90 transition-all flex items-center gap-3 outline-none uppercase tracking-wider">
          <ArrowLeft size={18} className={isRtl ? 'rotate-180' : ''} />
          {t('backToStore')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-10 md:mb-12 text-start">
        {t('title')}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Items List */}
        <div className="lg:col-span-8 space-y-4">
          <AnimatePresence mode="popLayout">
            {cart.map((item) => (
              <motion.div 
                key={item.id}
                layout
                initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card-surface rounded-3xl p-6 flex items-center gap-6 group hover:border-brand-orange/15 transition-colors text-start"
              >
                <div 
                  className="w-24 aspect-[2/3] rounded-xl bg-cover bg-center shrink-0 border border-edge"
                  style={{ backgroundImage: `url(${item.image})` }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-foreground truncate mb-1">{item.title}</h3>
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">{t('digitalDetail')}</p>
                  
                  <div className="mt-6 flex items-center gap-4">
                    <div className="flex items-center bg-surface border border-edge rounded-xl overflow-hidden">
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-2 hover:bg-white/5 text-white/40 hover:text-white transition-colors outline-none"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-10 text-center text-xs font-black text-white" dir="ltr" lang="en" translate="no">
                        {item.quantity.toLocaleString('en-US', { numberingSystem: 'latn' })}
                      </span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-2 hover:bg-white/5 text-white/40 hover:text-white transition-colors outline-none"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="text-brand-blue font-bold text-sm tabular-nums">{formatPrice(item.price * item.quantity, locale)}</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => removeItem(item.id)}
                  className="p-4 rounded-2xl bg-white/5 text-white/20 hover:bg-red-500/10 hover:text-red-500 transition-all outline-none"
                >
                  <Trash2 size={20} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-4 lg:sticky lg:top-28 h-fit">
          <div className="bg-surface-elevated border border-edge rounded-[40px] p-8 shadow-xl shadow-black/40 relative overflow-hidden ring-1 ring-white/[0.04]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/5 blur-[60px] pointer-events-none" />
            
            <h2 className="text-xl font-bold tracking-tight text-foreground mb-8 text-start">{t('summary')}</h2>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-sm font-medium text-muted uppercase tracking-wider text-start">
                <span>{t('items')} (<span lang="en" translate="no">{itemCount.toLocaleString('en-US', { numberingSystem: 'latn' })}</span>)</span>
                <span className="text-foreground font-bold tabular-nums" lang="en" translate="no">{formatPrice(subtotal, locale)}</span>
              </div>
              {discountApplied && (
                <div className="flex justify-between text-sm font-semibold text-brand-orange uppercase tracking-wider text-start">
                  <span>{t('discountLabel')}</span>
                  <span className="font-black">- {formatPrice(discountAmount, locale)}</span>
                </div>
              )}
              <div className="pt-4 border-t border-edge flex flex-col gap-1">
                <div className="flex justify-between items-end">
                   <span className="text-xs font-medium text-muted uppercase tracking-wider leading-none">{t('total')}</span>
                   <p className="text-4xl font-bold text-foreground leading-none tracking-tight tabular-nums" lang="en" translate="no">
                     {formatPrice(total, locale)}
                   </p>
                </div>
              </div>
            </div>

            {/* Discount Code */}
            <div className="mb-8">
              <label className="text-[10px] font-medium text-faint uppercase tracking-wider mb-3 block text-start">{t('discountCode')}</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Tag size={16} className="absolute start-4 top-1/2 -translate-y-1/2 text-white/20" />
                  <input 
                    type="text" 
                    placeholder={t('discountPlaceholder')}
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    className="w-full bg-surface border border-edge rounded-xl py-3 ps-11 pe-4 text-xs font-medium text-foreground uppercase placeholder:text-faint focus:outline-none focus:border-brand-orange/45 focus:ring-2 focus:ring-focus-ring transition-all outline-none"
                  />
                </div>
                <button 
                  onClick={() => { if(discountCode === 'SAVE10') setDiscountApplied(true); }}
                  className="px-4 bg-surface-elevated border border-edge text-xs font-semibold uppercase rounded-xl hover:bg-white/5 transition-all outline-none"
                >
                  {t('apply')}
                </button>
              </div>
            </div>

            <Link href="/checkout" className="w-full py-5 bg-brand-purple text-white font-semibold rounded-2xl shadow-[0_16px_36px_rgba(181,0,255,0.22)] hover:bg-brand-purple/90 active:scale-95 transition-all text-center flex items-center justify-center gap-3 outline-none uppercase tracking-wider">
              {t('checkout')}
              <ArrowRight size={20} className="rtl:rotate-180" />
            </Link>

            <div className="mt-8 flex items-center justify-center gap-3 opacity-20 grayscale grayscale-100">
              <ShieldCheck size={16} />
              <span className="text-[9px] font-medium uppercase tracking-wider text-muted leading-none">{t('encrypted')}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
