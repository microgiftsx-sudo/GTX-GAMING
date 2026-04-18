"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { EUR_PER_IQD } from '@/lib/currency';

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
  subtotal: number;
  // Currency Engine
  currency: string;
  setCurrency: (c: string) => void;
  formatPrice: (priceInIQD: number, locale?: string) => string;
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

  // Load from localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem('gtx-cart');
    const savedCurr = localStorage.getItem('gtx-currency');
    if (savedCart) {
      try { setCart(JSON.parse(savedCart)); } catch (e) {}
    }
    if (savedCurr) setCurrency(savedCurr);
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('gtx-cart', JSON.stringify(cart));
    }
  }, [cart, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('gtx-currency', currency);
    }
  }, [currency, isLoaded]);

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

  const clearCart = () => setCart([]);

  const formatPrice = (priceInIQD: number, locale: string = 'en') => {
    const rate = RATES[currency] || 1;
    const value = priceInIQD * rate;
    
    if (currency === 'IQD') {
      const symbol = locale === 'ar' ? 'د.ع' : 'IQD';
      return `${value.toLocaleString('en-US', { numberingSystem: 'latn' })} ${symbol}`;
    }
    
    const symbol = SYMBOLS[currency];
    return `${symbol}${value.toLocaleString('en-US', { 
      numberingSystem: 'latn',
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const itemCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{ 
      cart, addItem, removeItem, updateQuantity, clearCart, itemCount, subtotal, 
      currency, setCurrency, formatPrice 
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
