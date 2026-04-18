"use client";

import { useCookieConsent } from "@/context/CookieConsentContext";
import CookieBanner from "@/components/layout/CookieBanner";

/** Renders the cookie bar when no choice exists yet or user opened settings from the footer. */
export default function CookieBannerHost() {
  const { bannerVisible } = useCookieConsent();
  if (!bannerVisible) return null;
  return <CookieBanner />;
}
