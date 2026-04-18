"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Cookie } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useCookieConsent } from "@/context/CookieConsentContext";

export default function CookieBanner() {
  const t = useTranslations("CookieConsent");
  const {
    consent,
    settingsOpen,
    acceptAll,
    rejectNonEssential,
    savePreferences,
    closeSettings,
  } = useCookieConsent();

  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (consent) {
      setAnalytics(consent.analytics);
      setMarketing(consent.marketing);
    } else {
      setAnalytics(false);
      setMarketing(false);
    }
  }, [consent]);

  useEffect(() => {
    if (settingsOpen) setExpanded(true);
  }, [settingsOpen]);

  const showCancel = settingsOpen && consent !== null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[100] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-edge bg-brand-dark/95 p-4 shadow-[0_-8px_40px_rgba(0,0,0,0.55)] backdrop-blur-md md:p-6">
        <div className="flex gap-3 md:gap-4">
          <div
            className="hidden shrink-0 sm:flex size-11 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange ring-1 ring-brand-orange/25"
            aria-hidden
          >
            <Cookie size={22} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <h2
              id="cookie-consent-title"
              className="text-sm font-bold text-foreground md:text-base"
            >
              {t("title")}
            </h2>
            <p className="text-xs leading-relaxed text-muted md:text-sm">{t("description")}</p>
            <p className="text-[11px] leading-relaxed text-faint">
              <Link
                href="#"
                className="text-brand-orange underline-offset-2 hover:underline"
              >
                {t("privacyLink")}
              </Link>
            </p>

            {expanded && (
              <div className="space-y-3 rounded-xl border border-edge bg-surface-elevated/80 p-3 md:p-4">
                <label className="flex cursor-pointer items-start gap-3 touch-manipulation">
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    className="mt-1 size-4 shrink-0 rounded border-edge accent-brand-orange"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">
                      {t("analyticsTitle")}
                    </span>
                    <span className="block text-xs text-muted">{t("analyticsDesc")}</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 touch-manipulation">
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="mt-1 size-4 shrink-0 rounded border-edge accent-brand-orange"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">
                      {t("marketingTitle")}
                    </span>
                    <span className="block text-xs text-muted">{t("marketingDesc")}</span>
                  </span>
                </label>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
              {showCancel && (
                <button
                  type="button"
                  onClick={closeSettings}
                  className="order-last w-full min-h-11 rounded-xl border border-edge px-4 text-xs font-semibold uppercase tracking-wider text-muted transition-colors hover:bg-white/5 sm:order-none sm:w-auto"
                >
                  {t("cancel")}
                </button>
              )}
              {!expanded ? (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="w-full min-h-11 rounded-xl border border-edge px-4 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-white/5 sm:w-auto"
                >
                  {t("customize")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={rejectNonEssential}
                className="w-full min-h-11 rounded-xl border border-edge px-4 text-xs font-semibold uppercase tracking-wider text-muted transition-colors hover:bg-white/5 sm:w-auto"
              >
                {t("reject")}
              </button>
              {expanded && (
                <button
                  type="button"
                  onClick={() => savePreferences(analytics, marketing)}
                  className="w-full min-h-11 rounded-xl border border-brand-orange/50 bg-brand-orange/10 px-4 text-xs font-semibold uppercase tracking-wider text-brand-orange transition-colors hover:bg-brand-orange/20 sm:w-auto"
                >
                  {t("save")}
                </button>
              )}
              <button
                type="button"
                onClick={acceptAll}
                className="w-full min-h-11 rounded-xl bg-brand-orange px-4 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-brand-orange/25 transition-colors hover:bg-brand-orange/90 sm:w-auto"
              >
                {t("acceptAll")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
