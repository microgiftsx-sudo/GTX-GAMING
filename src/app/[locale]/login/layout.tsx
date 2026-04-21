import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
