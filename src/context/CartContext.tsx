"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { EUR_PER_IQD } from '@/lib/currency';
import { netFromGrossIqd } from '@/lib/tax-math';
import { discountIqdFromPercent, normalizeCouponCode } from '@/lib/coupon-math';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export type AppliedCoupon = { code: string; percentOff: number };

export interface CartItem {
  id: string | number;
  title: string;
  price: number; // Base price in IQD
  image: string;
  quantity: number;
  /** When set, merges lines with the same key instead of the same `id`. */
  cartKey?: string;
}

interface CartContextType {
  cart: CartItem[];
  addItem: (item: CartItem, options?: { showFeedback?: boolean }) => void;
  removeItem: (id: string | number) => void;
  updateQuantity: (id: string | number, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  /** When VAT is on: net IQD (ex-VAT). When off: same as subtotal (gross). */
  subtotalBeforeTax: number;
  /** IQD VAT portion of the cart (from gross line totals). */
  taxAmount: number;
  /** IQD gross line total (VAT-inclusive when tax is enabled), before coupon */
  subtotal: number;
  /** IQD discount from applied coupon */
  couponDiscountIqd: number;
  /** IQD total after coupon (minimum 0) */
  grandTotal: number;
  appliedCoupon: AppliedCoupon | null;
  applyCouponCode: (code: string) => Promise<{ ok: boolean; reason?: string }>;
  clearAppliedCoupon: () => void;
  taxRatePercent: number;
  // Currency Engine
  currency: string;
  setCurrency: (c: string) => void;
  /** IQD list price (VAT-inclusive from API) → formatted in selected currency */
  formatPrice: (priceInIQD: number, locale?: string) => string;
  /** IQD amount already final (totals, discounts) — currency conversion only, no extra tax */
  formatDisplayIqd: (amountIqd: number, locale?: string) => string;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const RATES: Record<string, number> = {
  IQD: 1,
  USD: 0.00068,
  EUR: EUR_PER_IQD,
};

const SYMBOLS: Record<string, string> = {
  'IQD': 'IQD',
  'USD': '$',
  'EUR': '€',
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const tp = useTranslations('Product');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currency, setCurrency] = useState('IQD');
  const [isLoaded, setIsLoaded] = useState(false);
  const [taxRatePercent, setTaxRatePercent] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [cartAddedOpen, setCartAddedOpen] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem('gtx-cart-v2');
    const savedCurr = localStorage.getItem('gtx-currency');
    const savedCoupon = localStorage.getItem('gtx-applied-coupon');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch {}
    }
    if (savedCurr) setCurrency(savedCurr);
    if (savedCoupon) {
      try {
        const parsed = JSON.parse(savedCoupon) as AppliedCoupon;
        if (parsed?.code && typeof parsed.percentOff === 'number') {
          setAppliedCoupon({ code: String(parsed.code).toUpperCase(), percentOff: parsed.percentOff });
        }
      } catch {}
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    fetch('/api/tax')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ratePercent?: number } | null) => {
        if (cancelled || !data || typeof data.ratePercent !== 'number') return;
        setTaxRatePercent(Math.max(0, Math.min(100, data.ratePercent)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLoaded]);

  // Save to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('gtx-cart-v2', JSON.stringify(cart));
    }
  }, [cart, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('gtx-currency', currency);
    }
  }, [currency, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    if (appliedCoupon) {
      localStorage.setItem('gtx-applied-coupon', JSON.stringify(appliedCoupon));
    } else {
      localStorage.removeItem('gtx-applied-coupon');
    }
  }, [appliedCoupon, isLoaded]);

  const applyCouponCode = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return { ok: false as const, reason: 'empty' };
    const r = await fetch(`/api/coupons/validate?code=${encodeURIComponent(trimmed)}`);
    const data = (await r.json()) as { valid?: boolean; percentOff?: number; reason?: string };
    if (!data.valid || typeof data.percentOff !== 'number') {
      return { ok: false as const, reason: data.reason ?? 'invalid' };
    }
    setAppliedCoupon({ code: normalizeCouponCode(trimmed), percentOff: data.percentOff });
    return { ok: true as const };
  };

  const clearAppliedCoupon = () => setAppliedCoupon(null);

  const lineKey = (i: CartItem) => i.cartKey ?? String(i.id);

  const addItem = (item: CartItem, options?: { showFeedback?: boolean }) => {
    setCart((prev) => {
      const key = lineKey(item);
      const existing = prev.find((i) => lineKey(i) === key);
      if (existing) {
        return prev.map((i) => (lineKey(i) === key ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    if (options?.showFeedback !== false) {
      setCartAddedOpen(true);
    }
  };

  const removeItem = (lineId: string | number) => {
    const s = String(lineId);
    setCart((prev) => prev.filter((i) => lineKey(i) !== s));
  };

  const updateQuantity = (lineId: string | number, quantity: number) => {
    if (quantity < 1) return;
    const s = String(lineId);
    setCart((prev) =>
      prev.map((item) => (lineKey(item) === s ? { ...item, quantity } : item)),
    );
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
  };

  const formatPrice = (priceInIQD: number, locale: string = 'en') => {
    const rate = RATES[currency] || 1;
    const value = Math.round(priceInIQD) * rate;

    if (currency === 'IQD') {
      const symbol = locale === 'ar' ? 'د.ع' : 'IQD';
      return `${value.toLocaleString('en-US', { numberingSystem: 'latn' })} ${symbol}`;
    }

    const symbol = SYMBOLS[currency];
    return `${symbol}${value.toLocaleString('en-US', {
      numberingSystem: 'latn',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDisplayIqd = (amountIqd: number, locale: string = 'en') => {
    const rounded = Math.round(amountIqd);
    const rate = RATES[currency] || 1;
    const value = rounded * rate;

    if (currency === 'IQD') {
      const symbol = locale === 'ar' ? 'د.ع' : 'IQD';
      return `${value.toLocaleString('en-US', { numberingSystem: 'latn' })} ${symbol}`;
    }

    const symbol = SYMBOLS[currency];
    return `${symbol}${value.toLocaleString('en-US', {
      numberingSystem: 'latn',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const itemCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  /** Gross IQD (VAT-inclusive line totals from API). */
  const grossSubtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [cart],
  );
  const subtotalBeforeTax = useMemo(() => {
    if (taxRatePercent <= 0) return grossSubtotal;
    return netFromGrossIqd(grossSubtotal, taxRatePercent);
  }, [grossSubtotal, taxRatePercent]);
  const taxAmount = useMemo(() => {
    if (taxRatePercent <= 0) return 0;
    return grossSubtotal - subtotalBeforeTax;
  }, [grossSubtotal, subtotalBeforeTax, taxRatePercent]);
  const subtotal = grossSubtotal;

  const couponDiscountIqd = useMemo(() => {
    if (!appliedCoupon) return 0;
    return discountIqdFromPercent(subtotal, appliedCoupon.percentOff);
  }, [subtotal, appliedCoupon]);

  const grandTotal = useMemo(
    () => Math.max(0, subtotal - couponDiscountIqd),
    [subtotal, couponDiscountIqd],
  );

  return (
    <CartContext.Provider value={{
      cart,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      itemCount,
      subtotalBeforeTax,
      taxAmount,
      subtotal,
      couponDiscountIqd,
      grandTotal,
      appliedCoupon,
      applyCouponCode,
      clearAppliedCoupon,
      taxRatePercent,
      currency,
      setCurrency,
      formatPrice,
      formatDisplayIqd,
    }}>
      {children}
      <AnimatePresence>
        {cartAddedOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:px-4"
            onClick={() => setCartAddedOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-[30px] border border-edge bg-surface-elevated p-6 text-start shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.04] sm:p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rounded-2xl border border-edge bg-surface px-4 py-3">
                <h3 className="text-lg font-bold text-foreground">{tp('addedToCartTitle')}</h3>
                <p className="mt-1 text-sm text-muted">{tp('addedToCartHint')}</p>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Link
                  href="/cart"
                  onClick={() => setCartAddedOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-orange/40 bg-brand-orange/10 px-4 py-2 text-sm font-semibold text-brand-orange transition-colors hover:bg-brand-orange/20"
                >
                  {tp('goToCart')}
                </Link>
                <button
                  type="button"
                  onClick={() => setCartAddedOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-edge bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-white/5"
                >
                  {tp('continueShopping')}
                </button>
              </div>
              <Link
                href="/checkout"
                onClick={() => setCartAddedOpen(false)}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-brand-blue/35 bg-brand-blue/10 px-4 py-2 text-sm font-semibold text-brand-blue transition-colors hover:bg-brand-blue/20"
              >
                {tp('checkoutNow')}
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
