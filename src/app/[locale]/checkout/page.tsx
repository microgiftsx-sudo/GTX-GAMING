"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, CheckCircle2, Upload, QrCode, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useCart } from '@/context/CartContext';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';

export default function CheckoutPage() {
  const t = useTranslations('Checkout');
  const d = useTranslations('Data');
  const ui = useTranslations('UI');
  const locale = useLocale();
  const router = useRouter();
  const isRtl = locale === 'ar';
  const { cart, grandTotal, appliedCoupon, formatDisplayIqd, clearCart } = useCart();
  const [currentStep, setCurrentStep] = useState(0);
  const [email, setEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const STEPS = [
    { id: 'email', title: t('steps.email') },
    { id: 'payment', title: t('steps.payment') },
    { id: 'details', title: t('steps.details') },
    { id: 'receipt', title: t('steps.receipt') },
  ];

  const METHODS = [
    { id: 'fib', name: d('methods.fib'), icon: '/icons/firstbank.png', account: '8000 9999 1111' },
    { id: 'zain', name: d('methods.zain'), icon: '/icons/zaincash.png', account: '0780 123 4567' },
    { id: 'qi', name: d('methods.qi'), icon: '/icons/superqi.png', account: '7000 1234 5678' },
    { id: 'fastpay', name: d('methods.fastpay'), icon: '/icons/fastpay.png', account: '4000 4444 5555' },
  ];

  const [methods, setMethods] = useState(METHODS);
  const [selectedMethod, setSelectedMethod] = useState(METHODS[0]);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/payment-methods')
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (!payload || cancelled || !Array.isArray(payload.methods) || payload.methods.length === 0) return;
        setMethods(payload.methods);
        setSelectedMethod(payload.methods[0]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const pageVariants = {
    initial: { opacity: 0, x: isRtl ? -20 : 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: isRtl ? 20 : -20 },
  };

  const submitOrder = async () => {
    if (!file || cart.length === 0) return;
    try {
      setSubmitError('');
      setIsSubmitting(true);
      const form = new FormData();
      form.set('email', email);
      form.set('locale', locale);
      form.set('paymentMethodId', selectedMethod.id);
      form.set('subtotal', String(grandTotal));
      if (appliedCoupon?.code) {
        form.set('couponCode', appliedCoupon.code);
      }
      form.set(
        'items',
        JSON.stringify(
          cart.map((item) => ({
            id: String(item.id),
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
          })),
        ),
      );
      form.set('receipt', file);

      const response = await fetch('/api/orders', {
        method: 'POST',
        body: form,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Order failed');
      }
      clearCart();
      const orderId = String(payload.order?.id ?? '').trim();
      const token = String(payload.order?.viewerToken ?? '').trim();
      if (orderId && token) {
        router.push(`/order-processing?orderId=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`);
        return;
      }
      alert(`${ui('orderSubmitted')} #${payload.order?.id ?? ''}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : ui('noResults'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-4">
      
      <div className="w-full max-w-xl mb-8 flex items-center justify-between">
        <Link href="/cart" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group outline-none">
          <ArrowLeft size={18} className={`transition-transform ${isRtl ? 'rotate-180 group-hover:translate-x-1' : 'group-hover:-translate-x-1'}`} />
          <span className="text-xs font-black uppercase tracking-widest italic text-start">{t('back')}</span>
        </Link>
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-brand-blue" />
          <span className="text-[10px] font-black text-white/30 uppercase tracking-widest italic">{t('secure')}</span>
        </div>
      </div>

      <div className="w-full max-w-xl bg-brand-card border border-white/5 rounded-[40px] shadow-[0_50px_100px_rgba(0,0,0,0.5)] overflow-hidden">
        
        {/* Progress Bar */}
        <div className="px-10 pt-10 pb-6 flex items-center justify-between border-b border-white/5 overflow-x-auto no-scrollbar">
          {STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                  index <= currentStep ? 'bg-brand-orange text-white' : 'bg-white/5 text-white/20'
                }`} dir="ltr" lang="en" translate="no">
                  {index < currentStep ? <CheckCircle2 size={16} /> : (index + 1).toLocaleString('en-US', { numberingSystem: 'latn' })}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${
                  index === currentStep ? 'text-white' : 'text-white/20'
                }`}>
                  {step.title}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`flex-1 min-w-[20px] h-[2px] mb-6 mx-2 ${index < currentStep ? 'bg-brand-orange/30' : 'bg-white/5'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Content Area */}
        <div className="p-10 min-h-[400px]">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: Email */}
            {currentStep === 0 && (
              <motion.div key="email" {...pageVariants} className="space-y-6">
                <div className="text-start">
                  <h2 className="text-2xl font-black tracking-tighter italic uppercase mb-2">{t('digital')} <span className="text-brand-orange">{t('delivery')}</span></h2>
                  <p className="text-sm text-white/40">{t('deliveryDesc')}</p>
                </div>
                <div className="relative">
                  <Mail className="absolute start-5 top-1/2 -translate-y-1/2 text-white/20" size={20} />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={ui('emailPlaceholder')}
                    className="w-full bg-brand-dark p-5 ps-14 pe-4 rounded-2xl border border-white/10 text-white focus:outline-none focus:border-brand-orange/50 focus:ring-4 focus:ring-brand-orange/5 transition-all outline-none"
                  />
                </div>
                 <div className="p-4 bg-brand-card/50 rounded-xl border border-white/5 flex justify-between items-center text-start">
                    <span className="text-xs font-bold text-white/40 uppercase">{t('amount')}</span>
                    <span className="text-lg font-black text-brand-orange leading-none" dir="ltr">{formatDisplayIqd(grandTotal, locale)}</span>
                 </div>
                <button onClick={nextStep} disabled={!email.includes('@')} className="w-full py-5 bg-brand-orange text-white font-black rounded-2xl shadow-xl hover:bg-brand-orange/90 active:scale-95 transition-all text-lg disabled:opacity-50 disabled:pointer-events-none outline-none tracking-widest uppercase">
                  {ui('continueToPayment')}
                </button>
              </motion.div>
            )}

            {/* STEP 2: Payment Method */}
            {currentStep === 1 && (
              <motion.div key="payment" {...pageVariants} className="space-y-6">
                <div className={`text-left ltr:text-left rtl:text-right ${isRtl ? 'text-right' : 'text-left'}`}>
                  <h2 className="text-2xl font-black tracking-tighter italic uppercase mb-2">{t('chooseMethod')}</h2>
                  <p className="text-sm text-white/40">{t('chooseMethodDesc')}</p>
                </div>
                <div
                  className={
                    methods.length === 1
                      ? 'mx-auto grid max-w-xs grid-cols-1 gap-3'
                      : 'grid grid-cols-2 gap-3'
                  }
                >
                  {methods.map((method) => (
                    <button 
                      key={method.id} 
                      onClick={() => setSelectedMethod(method)}
                      type="button"
                      className={`rounded-3xl border-2 flex flex-col items-center justify-center gap-3 text-center transition-all outline-none ${
                        methods.length === 1 ? 'w-full p-5' : 'w-full p-4 sm:p-5'
                      } ${
                        selectedMethod.id === method.id 
                        ? 'bg-white/5 border-brand-orange shadow-lg' 
                        : 'bg-transparent border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className={`rounded-xl p-2 shadow-sm ring-1 ${
                        selectedMethod.id === method.id
                          ? 'bg-white ring-white/25'
                          : 'bg-white/90 ring-white/15'
                      }`}>
                        <img
                          src={method.icon}
                          alt={method.name}
                          className="h-9 w-9 object-contain"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <span className={`text-[11px] sm:text-xs font-black uppercase leading-tight ${
                        selectedMethod.id === method.id ? 'text-white' : 'text-white/80'
                      }`}>{method.name}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-4">
                  <button onClick={prevStep} className="flex-1 py-5 border border-white/10 text-white/40 font-black rounded-2xl hover:bg-white/5 transition-all outline-none uppercase tracking-widest">{ui('back')}</button>
                  <button onClick={nextStep} className="flex-[2] py-5 bg-brand-blue text-white font-black rounded-2xl shadow-xl hover:bg-brand-blue/90 active:scale-95 transition-all outline-none uppercase tracking-widest">{ui('proceedToPay')}</button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Transfer Details & QR */}
            {currentStep === 2 && (
              <motion.div key="details" {...pageVariants} className="space-y-6 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center border border-white/10 mb-2 shadow-lg">
                    <img
                      src={selectedMethod.icon}
                      alt={selectedMethod.name}
                      className="h-14 w-14 object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tighter italic">{t('transferTo')} <span className="text-brand-orange">{selectedMethod.name}</span></h3>
                </div>
                
                <div className="bg-brand-dark p-6 rounded-3xl border border-white/5 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{t('accountNumber')}</span>
                    <span className="text-lg font-black text-white" lang="en" translate="no">{selectedMethod.account}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{t('amount')}</span>
                    <span className="text-lg font-black text-brand-orange" lang="en" translate="no">{formatDisplayIqd(grandTotal, locale)}</span>
                  </div>
                </div>

                <div className="relative p-6 bg-white rounded-3xl max-w-[200px] mx-auto group cursor-pointer active:scale-95 transition-all shadow-2xl overflow-hidden">
                  {(() => {
                    const qrUrl = (selectedMethod as { barcodeUrl?: string }).barcodeUrl?.trim();
                    return qrUrl ? (
                    <img
                      src={qrUrl}
                      alt=""
                      className="h-[150px] w-[150px] object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <QrCode size={150} className="text-black" />
                  );
                  })()}
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-3xl">
                    <span className="bg-brand-dark text-white text-[10px] font-black px-3 py-1 rounded tracking-widest uppercase">{ui('scanToPay')}</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={prevStep} className="flex-1 py-5 border border-white/10 text-white/40 font-black rounded-2xl hover:bg-white/5 transition-all outline-none uppercase tracking-widest">{ui('back')}</button>
                  <button onClick={nextStep} className="flex-[2] py-5 bg-brand-purple text-white font-black rounded-2xl shadow-xl hover:bg-brand-purple/90 active:scale-95 transition-all outline-none uppercase tracking-widest">{t('paid')}</button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: Receipt Upload */}
            {currentStep === 3 && (
              <motion.div key="receipt" {...pageVariants} className="space-y-6">
                <div className={`text-left ltr:text-left rtl:text-right ${isRtl ? 'text-right' : 'text-left'}`}>
                  <h2 className="text-2xl font-black tracking-tighter italic uppercase mb-2">{t('uploadProof')}</h2>
                  <p className="text-sm text-white/40">{t('uploadDesc', { email: email })}</p>
                </div>

                <label className="block">
                  <div className="border-2 border-dashed border-white/10 rounded-[32px] p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-brand-purple/50 hover:bg-brand-purple/5 transition-all group shadow-inner">
                    <div className="p-4 bg-brand-purple/10 rounded-2xl text-brand-purple group-hover:scale-110 transition-transform">
                      <Upload size={32} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-white uppercase tracking-widest">{t('selectFile')}</p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} 
                    />
                  </div>
                </label>

                {file && (
                  <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="w-10 h-10 bg-brand-purple/20 rounded-lg flex items-center justify-center text-brand-purple">
                      <CheckCircle2 size={20} />
                    </div>
                    <div className="flex-1 min-w-0 text-start">
                      <p className="text-xs font-black text-white truncate">{file.name}</p>
                    </div>
                  </div>
                )}
                {submitError && (
                  <div className="text-xs text-red-300 border border-red-400/30 rounded-xl p-3 bg-red-500/10">
                    {submitError}
                  </div>
                )}

                <div className="flex gap-4">
                  <button onClick={prevStep} className="flex-1 py-5 border border-white/10 text-white/40 font-black rounded-2xl hover:bg-white/5 transition-all outline-none uppercase tracking-widest">{ui('back')}</button>
                  <button 
                    onClick={submitOrder}
                    disabled={!file || isSubmitting || cart.length === 0}
                    className="flex-[2] py-5 bg-brand-orange text-white font-black rounded-2xl shadow-xl hover:bg-brand-orange/90 active:scale-95 transition-all outline-none uppercase tracking-widest disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isSubmitting ? `${t('submitOrder')}...` : t('submitOrder')}
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <div className="bg-brand-dark/50 p-6 flex items-center justify-center gap-4">
          <ShieldCheck size={18} className="text-brand-blue" />
          <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] italic leading-none">{t('secure')}</span>
        </div>

      </div>
    </div>
  );
}
