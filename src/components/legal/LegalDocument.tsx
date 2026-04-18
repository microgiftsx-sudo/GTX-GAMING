"use client";

import { useTranslations } from "next-intl";

type Section = { heading: string; body: string };

type Ns = "LegalPrivacy" | "LegalTerms" | "LegalGuarantee";

export default function LegalDocument({ namespace }: { namespace: Ns }) {
  const t = useTranslations(namespace);
  const raw = t.raw("sections");
  const sections = (Array.isArray(raw) ? raw : []) as Section[];

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 md:py-16 text-start">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-orange">{t("updated")}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">{t("title")}</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">{t("intro")}</p>

      <div className="mt-10 space-y-10">
        {sections.map((s, i) => (
          <section key={i} className="border-t border-edge pt-8 first:border-t-0 first:pt-0">
            <h2 className="text-lg font-bold text-foreground md:text-xl">{s.heading}</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted whitespace-pre-line">
              {s.body}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
