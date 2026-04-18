"use client";

import { useTranslations } from "next-intl";
import { Mail, MapPin, Phone, Clock, Send } from "lucide-react";
import { SITE } from "@/lib/site";

export default function ContactPageContent() {
  const t = useTranslations("LegalContact");

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 md:py-16 text-start">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-orange">{t("kicker")}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">{t("title")}</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">{t("intro")}</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <a
          href={`mailto:${SITE.email}`}
          className="card-surface flex gap-4 rounded-2xl p-5 transition-colors hover:border-brand-orange/30"
        >
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange">
            <Mail size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("emailLabel")}</p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground" dir="ltr">
              {SITE.email}
            </p>
          </div>
        </a>

        <a
          href={`tel:${SITE.phoneE164}`}
          className="card-surface flex gap-4 rounded-2xl p-5 transition-colors hover:border-brand-orange/30"
        >
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-blue/15 text-brand-blue">
            <Phone size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("phoneLabel")}</p>
            <p className="mt-1 text-sm font-semibold text-foreground" dir="ltr" translate="no">
              {SITE.phoneDisplay}
            </p>
          </div>
        </a>

        <div className="card-surface flex gap-4 rounded-2xl p-5 sm:col-span-2">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-purple/15 text-brand-purple">
            <MapPin size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("locationLabel")}</p>
            <p className="mt-1 text-sm text-foreground">{t("locationValue")}</p>
          </div>
        </div>

        <div className="card-surface flex gap-4 rounded-2xl p-5 sm:col-span-2">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-muted">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("hoursLabel")}</p>
            <p className="mt-1 text-sm text-foreground">{t("hoursValue")}</p>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">{t("socialTitle")}</p>
        <div className="flex flex-wrap gap-3">
          <a
            href={SITE.social.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-edge bg-surface-elevated px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-brand-orange/40"
          >
            <Send size={18} className="text-brand-orange" />
            {t("socialTelegram")}
          </a>
          <a
            href={SITE.social.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-edge bg-surface-elevated px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-brand-orange/40"
          >
            {t("socialInstagram")}
          </a>
          <a
            href={SITE.social.discord}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-edge bg-surface-elevated px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-brand-orange/40"
          >
            {t("socialDiscord")}
          </a>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-faint">{t("socialNote")}</p>
      </div>

      <div className="mt-12 rounded-2xl border border-dashed border-edge bg-surface-elevated/40 p-6">
        <p className="text-sm leading-relaxed text-muted whitespace-pre-line">{t("closing")}</p>
      </div>
    </article>
  );
}
