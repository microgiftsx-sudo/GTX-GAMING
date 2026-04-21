import { auth } from '@/auth';
import { Link } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';
import { listOrdersByEmail, type OrderStatus } from '@/lib/orders';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Purchases' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

export default async function PurchasesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Purchases' });
  const session = await auth();
  const userEmail = session?.user?.email?.trim() ?? '';
  const orders = userEmail ? await listOrdersByEmail(userEmail) : [];

  const statusLabel = (status: OrderStatus) => {
    switch (status) {
      case 'completed':
        return t('statusCompleted');
      case 'processing':
        return t('statusProcessing');
      case 'on_hold':
        return t('statusOnHold');
      case 'refunded':
        return t('statusRefunded');
      case 'cancelled':
        return t('statusCancelled');
      default:
        return t('statusPending');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="card-surface mx-auto max-w-3xl rounded-3xl border border-edge p-6 shadow-xl shadow-black/30 ring-1 ring-white/[0.04] sm:p-8">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{t('title')}</h1>
        <p className="mt-2 text-sm text-muted">
          {session?.user ? t('subtitle') : t('signinRequiredSubtitle')}
        </p>

        <div className="mt-6 rounded-2xl border border-edge bg-surface-elevated px-4 py-6 text-center">
          {!session?.user ? (
            <>
              <p className="text-sm font-semibold text-foreground">{t('signinRequiredTitle')}</p>
              <p className="mt-1 text-xs text-faint">{t('signinRequiredHint')}</p>
              <Link
                href="/login"
                className="mt-4 inline-flex rounded-xl border border-brand-orange/40 bg-brand-orange/10 px-4 py-2 text-xs font-semibold text-brand-orange transition-colors hover:bg-brand-orange/20"
              >
                {t('signinCta')}
              </Link>
            </>
          ) : orders.length === 0 ? (
            <>
              <p className="text-sm font-semibold text-foreground">{t('emptyTitle')}</p>
              <p className="mt-1 text-xs text-faint">{t('emptyHint')}</p>
              <Link
                href="/search"
                className="mt-4 inline-flex rounded-xl border border-brand-orange/40 bg-brand-orange/10 px-4 py-2 text-xs font-semibold text-brand-orange transition-colors hover:bg-brand-orange/20"
              >
                {t('browseStore')}
              </Link>
            </>
          ) : (
            <div className="space-y-3 text-start">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${encodeURIComponent(order.id)}?token=${encodeURIComponent(order.viewerToken)}`}
                  className="block rounded-2xl border border-edge bg-surface px-4 py-3 transition-colors hover:bg-white/5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground" dir="ltr" lang="en">
                      {order.id}
                    </p>
                    <span className="rounded-full border border-brand-orange/35 bg-brand-orange/10 px-2.5 py-1 text-[10px] font-semibold text-brand-orange">
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
                    <span>
                      {new Date(order.createdAt).toLocaleString(locale === 'ar' ? 'ar-IQ' : 'en-US')}
                    </span>
                    <span dir="ltr" lang="en">
                      {Math.round(order.subtotal).toLocaleString('en-US')} IQD
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
