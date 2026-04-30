import { Tajawal, Outfit } from "next/font/google";
import type { Viewport } from "next";
import "../globals.css";
import MegaHeader from "@/components/layout/MegaHeader";
import NavBar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer";
import { CartProvider } from "@/context/CartContext";
import { CookieConsentProvider } from "@/context/CookieConsentContext";
import CookieBannerHost from "@/components/layout/CookieBannerHost";
import { AuthSessionProvider } from "@/components/providers/AuthSessionProvider";
import SupportChatWidget from "@/components/support/SupportChatWidget";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["200", "300", "400", "500", "700", "800", "900"],
  variable: "--font-tajawal",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
 
  return {
    title: t('title'),
    description: t('description'),
    icons: {
      icon: '/icon.png',
      shortcut: '/icon.png',
      apple: '/icon.png',
    },
  };
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  // Providing all messages to the client
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body className={`${tajawal.variable} ${outfit.variable} antialiased text-foreground selection:bg-brand-orange selection:text-white`}>
        <NextIntlClientProvider messages={messages}>
          <AuthSessionProvider>
            <CookieConsentProvider>
              <CartProvider>
                <div className="flex flex-col min-h-screen min-h-[100dvh] pb-[env(safe-area-inset-bottom)]">
                  <MegaHeader />
                  <NavBar />
                  <main className="flex-grow">{children}</main>
                  <Footer />
                  <SupportChatWidget />
                </div>
              </CartProvider>
              <CookieBannerHost />
            </CookieConsentProvider>
          </AuthSessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
