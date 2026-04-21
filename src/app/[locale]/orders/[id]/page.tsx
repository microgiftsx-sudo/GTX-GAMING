import { getTranslations } from 'next-intl/server';
import { getOrder } from '@/lib/orders';
import { OrderProductDetailsDialog } from '@/components/orders/OrderProductDetailsDialog';
import { Link } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'OrderFlow' });
  return {
    title: t('statusPageTitle'),
    description: t('statusPageDescription'),
  };
}

function statusText(status: string, t: Awaited<ReturnType<typeof getTranslations>>) {
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
}

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id, locale } = await params;
  const { token } = await searchParams;
  const order = await getOrder(id);
  const t = await getTranslations({ locale, namespace: 'OrderFlow' });

  const allowed = Boolean(order && token && token === order.viewerToken);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="card-surface mx-auto max-w-2xl rounded-[32px] border border-edge p-7 shadow-xl shadow-black/30 ring-1 ring-white/[0.04] sm:p-9">
        {!allowed || !order ? (
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t('accessDeniedTitle')}</h1>
            <p className="mt-2 text-sm text-muted">{t('accessDeniedHint')}</p>
            <Link
              href="/"
              className="mt-6 inline-flex rounded-full border border-brand-orange/35 px-4 py-2 text-xs font-semibold text-brand-orange transition-colors hover:bg-brand-orange/10"
            >
              {t('goHome')}
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-edge bg-surface px-4 py-4">
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t('statusTitle')}</h1>
              <p className="mt-1 text-sm text-muted">{t('statusSubtitle')}</p>
            </div>

            <div className="mt-5 rounded-2xl border border-edge bg-surface-elevated p-4">
              <p className="text-xs text-faint">{t('orderNumber')}</p>
              <p className="text-sm font-semibold text-foreground" dir="ltr" lang="en">
                {order.id}
              </p>
              <p className="mt-3 text-xs text-faint">{t('orderStatus')}</p>
              <p className="text-sm font-semibold text-brand-orange">{statusText(order.status, t)}</p>
            </div>

            {order.deliveryDetails ? (
              <div className="mt-4 rounded-2xl border border-edge bg-surface-elevated p-4">
                <p className="text-xs text-faint">{t('deliveryDetails')}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-foreground">{order.deliveryDetails}</p>
              </div>
            ) : null}

            <OrderProductDetailsDialog
              status={order.status}
              itemTitles={order.items.map((item) => item.title)}
              productDetails={order.productDeliveryDetails}
              fallbackDetails={order.deliveryDetails}
              buttonLabel={t('viewProductDetails')}
              titleLabel={t('productDetailsTitle')}
              productLabel={t('productLabel')}
              closeLabel={t('close')}
            />
          </>
        )}
      </div>
    </div>
  );
}

