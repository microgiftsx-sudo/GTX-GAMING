import { auth } from '@/auth';
import { Link } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="card-surface mx-auto max-w-2xl rounded-3xl border border-edge p-6 shadow-xl shadow-black/30 ring-1 ring-white/[0.04] sm:p-8">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{t('title')}</h1>
        <p className="mt-2 text-sm text-muted">
          {session?.user ? t('subtitle') : t('signinRequiredSubtitle')}
        </p>

        <div className="mt-6 rounded-2xl border border-edge bg-surface-elevated px-4 py-6 text-center">
          {session?.user ? (
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
          )}
        </div>
      </div>
    </div>
  );
}
