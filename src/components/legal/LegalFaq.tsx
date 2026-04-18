"use client";

import { useTranslations } from "next-intl";

type Item = { q: string; a: string };

export default function LegalFaq() {
  const t = useTranslations("LegalFaq");
  const raw = t.raw("items");
  const items = (Array.isArray(raw) ? raw : []) as Item[];

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 md:py-16 text-start">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-orange">{t("updated")}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">{t("title")}</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">{t("intro")}</p>

      <div className="mt-10 space-y-6">
        {items.map((item, i) => (
          <div
            key={i}
            className="rounded-2xl border border-edge bg-surface-elevated/60 p-5 md:p-6 shadow-lg shadow-black/20"
          >
            <h2 className="text-base font-bold text-foreground md:text-lg">{item.q}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted whitespace-pre-line">{item.a}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
