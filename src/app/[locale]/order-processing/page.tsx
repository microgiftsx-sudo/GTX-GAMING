'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/routing';

export default function OrderProcessingPage() {
  const t = useTranslations('OrderFlow');
  const sp = useSearchParams();
  const orderId = sp.get('orderId') ?? '';
  const token = sp.get('token') ?? '';
  const orderHref =
    orderId && token
      ? `/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`
      : '/orders';

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="card-surface mx-auto max-w-xl rounded-[32px] border border-edge p-7 text-center shadow-xl shadow-black/30 ring-1 ring-white/[0.04] sm:p-9">
        <div className="rounded-2xl border border-edge bg-surface px-4 py-4">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t('title')}</h1>
          <p className="mt-2 text-sm text-muted">{t('subtitle')}</p>
        </div>
        {orderId ? (
          <p className="mt-4 text-xs font-semibold text-faint" dir="ltr" lang="en">
            {orderId}
          </p>
        ) : null}
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Link
            href={orderHref}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-orange/40 bg-brand-orange/10 px-4 py-3 text-sm font-semibold text-brand-orange transition-colors hover:bg-brand-orange/20"
          >
            {t('viewOrder')}
          </Link>
          <Link
            href="/search"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-edge bg-surface-elevated px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-white/5"
          >
            {t('continueShopping')}
          </Link>
        </div>
      </div>
    </div>
  );
}

