"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CookieConsentState } from "@/lib/cookie-consent";
import {
  defaultAccepted,
  defaultRejected,
  getConsentFromDocument,
  writeConsentToDocument,
} from "@/lib/cookie-consent";

type Ctx = {
  ready: boolean;
  consent: CookieConsentState | null;
  /** True while the bar is on screen (first visit or settings open). */
  bannerVisible: boolean;
  analyticsAllowed: boolean;
  marketingAllowed: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  savePreferences: (analytics: boolean, marketing: boolean) => void;
  openSettings: () => void;
  closeSettings: () => void;
  settingsOpen: boolean;
};

const CookieConsentContext = createContext<Ctx | null>(null);

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [consent, setConsent] = useState<CookieConsentState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setConsent(getConsentFromDocument());
    setReady(true);
  }, []);

  const persist = useCallback((next: CookieConsentState) => {
    writeConsentToDocument(next);
    setConsent(next);
    setSettingsOpen(false);
  }, []);

  const acceptAll = useCallback(() => {
    persist(defaultAccepted());
  }, [persist]);

  const rejectNonEssential = useCallback(() => {
    persist(defaultRejected());
  }, [persist]);

  const savePreferences = useCallback(
    (analytics: boolean, marketing: boolean) => {
      const t = Date.now();
      persist({
        v: 1,
        essential: true,
        analytics,
        marketing,
        updatedAt: t,
      });
    },
    [persist]
  );

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const bannerVisible = ready && (consent === null || settingsOpen);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      consent,
      bannerVisible,
      analyticsAllowed: consent?.analytics ?? false,
      marketingAllowed: consent?.marketing ?? false,
      acceptAll,
      rejectNonEssential,
      savePreferences,
      openSettings,
      closeSettings,
      settingsOpen,
    }),
    [
      ready,
      consent,
      bannerVisible,
      acceptAll,
      rejectNonEssential,
      savePreferences,
      openSettings,
      closeSettings,
      settingsOpen,
    ]
  );

  return (
    <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>
  );
}

export function useCookieConsent(): Ctx {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error("useCookieConsent must be used within CookieConsentProvider");
  }
  return ctx;
}
