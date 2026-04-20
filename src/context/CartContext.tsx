"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { EUR_PER_IQD } from '@/lib/currency';
import { netFromGrossIqd } from '@/lib/tax-math';
import { discountIqdFromPercent, normalizeCouponCode } from '@/lib/coupon-math';

export type AppliedCoupon = { code: string; percentOff: number };

export interface CartItem {
  id: string | number;
  title: string;
  price: number; // Base price in IQD
  image: string;
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addItem: (item: CartItem) => void;
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currency, setCurrency] = useState('IQD');
  const [isLoaded, setIsLoaded] = useState(false);
  const [taxRatePercent, setTaxRatePercent] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

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

  const addItem = (item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => 
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeItem = (id: string | number) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string | number, quantity: number) => {
    if (quantity < 1) return;
    setCart((prev) => prev.map((item) => 
      item.id === id ? { ...item, quantity } : item
    ));
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
