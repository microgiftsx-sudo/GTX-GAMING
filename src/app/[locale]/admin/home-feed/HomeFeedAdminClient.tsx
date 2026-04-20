"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

type ItemRow = {
  id: string;
  kinguinId: number;
  title: string;
  price: number;
};

type FeedPayload = {
  hero: { ids: string[]; max: number; items: ItemRow[] };
  trending: { ids: string[]; max: number; items: ItemRow[] };
  cacheTtlSeconds: number;
};

function parseIds(text: string): string[] {
  return text
    .split(/[\s,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type Props = {
  maxHero: number;
  maxTrending: number;
};

export default function HomeFeedAdminClient({ maxHero, maxTrending }: Props) {
  const t = useTranslations("HomeFeedAdmin");
  const [secret, setSecret] = useState("");
  const [heroText, setHeroText] = useState("");
  const [trendingText, setTrendingText] = useState("");
  const [payload, setPayload] = useState<FeedPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const authHeader = useCallback(
    () => ({
      Authorization: `Bearer ${secret.trim()}`,
    }),
    [secret],
  );

  const load = useCallback(async () => {
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch("/api/admin/home-feed", { headers: authHeader() });
      const data = (await r.json()) as FeedPayload & { error?: string };
      if (!r.ok) {
        setMsg({
          kind: "err",
          text:
            r.status === 401
              ? t("unauthorized")
              : r.status === 503
                ? t("noSecret")
                : data.error || t("loadFailed"),
        });
        setPayload(null);
        return;
      }
      setPayload(data);
      setHeroText(data.hero.ids.join("\n"));
      setTrendingText(data.trending.ids.join("\n"));
    } catch {
      setMsg({ kind: "err", text: t("loadFailed") });
      setPayload(null);
    } finally {
      setBusy(false);
    }
  }, [authHeader, t]);

  const save = useCallback(async () => {
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch("/api/admin/home-feed", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          heroIds: parseIds(heroText),
          trendingIds: parseIds(trendingText),
        }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) {
        setMsg({
          kind: "err",
          text:
            r.status === 401
              ? t("unauthorized")
              : r.status === 503
                ? t("noSecret")
                : data.error || t("saveFailed"),
        });
        return;
      }
      setMsg({ kind: "ok", text: t("savedOk") });
      await load();
    } catch {
      setMsg({ kind: "err", text: t("saveFailed") });
    } finally {
      setBusy(false);
    }
  }, [authHeader, heroText, trendingText, load, t]);

  return (
    <div className="mx-auto max-w-3xl px-3 py-8 sm:px-4 sm:py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
        </div>
        <Link
          href="/"
          className="text-sm font-semibold text-brand-orange hover:underline"
        >
          ← Home
        </Link>
      </div>

      <div className="card-surface space-y-4 p-4 sm:p-6">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
            {t("secretLabel")}
          </label>
          <input
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full rounded-xl border border-edge bg-surface px-3 py-2.5 text-sm text-foreground focus:border-brand-orange/45 focus:outline-none focus:ring-2 focus:ring-focus-ring"
            placeholder={t("secretHint")}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !secret.trim()}
            onClick={() => void load()}
            className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-white/15 disabled:opacity-50"
          >
            {t("load")}
          </button>
          <button
            type="button"
            disabled={busy || !secret.trim()}
            onClick={() => void save()}
            className="rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-orange/25 transition-colors hover:bg-brand-orange/90 disabled:opacity-50"
          >
            {t("save")}
          </button>
        </div>

        {msg && (
          <p
            className={
              msg.kind === "ok" ? "text-sm text-emerald-400" : "text-sm text-red-400"
            }
          >
            {msg.text}
          </p>
        )}

        {payload && (
          <p className="text-xs text-muted">
            {t("cacheNote", { seconds: payload.cacheTtlSeconds })}
          </p>
        )}

        <section className="space-y-2 border-t border-edge pt-4">
          <h2 className="text-sm font-bold text-foreground">
            {t("heroHeading")}{" "}
            <span className="font-normal text-muted">
              ({t("maxHero", { max: maxHero })})
            </span>
          </h2>
          <textarea
            value={heroText}
            onChange={(e) => setHeroText(e.target.value)}
            rows={4}
            className="w-full resize-y rounded-xl border border-edge bg-surface px-3 py-2 font-mono text-xs text-foreground focus:border-brand-orange/45 focus:outline-none focus:ring-2 focus:ring-focus-ring"
            placeholder={t("idsPlaceholder")}
          />
        </section>

        <section className="space-y-2 border-t border-edge pt-4">
          <h2 className="text-sm font-bold text-foreground">
            {t("trendingHeading")}{" "}
            <span className="font-normal text-muted">
              ({t("maxTrending", { max: maxTrending })})
            </span>
          </h2>
          <textarea
            value={trendingText}
            onChange={(e) => setTrendingText(e.target.value)}
            rows={5}
            className="w-full resize-y rounded-xl border border-edge bg-surface px-3 py-2 font-mono text-xs text-foreground focus:border-brand-orange/45 focus:outline-none focus:ring-2 focus:ring-focus-ring"
            placeholder={t("idsPlaceholder")}
          />
        </section>

        <section className="border-t border-edge pt-4">
          <h2 className="mb-2 text-sm font-bold text-foreground">
            {t("preview")}
          </h2>
          {!payload ? (
            <p className="text-sm text-muted">{t("noPreview")}</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
                  {t("heroHeading")}
                </p>
                <ul className="space-y-1 rounded-lg border border-edge bg-surface/50 p-2">
                  {payload.hero.items.length === 0 ? (
                    <li className="text-muted">—</li>
                  ) : (
                    payload.hero.items.map((p) => (
                      <li key={p.id} className="text-foreground">
                        <span className="text-faint">{t("storeId")}:</span>{" "}
                        {p.kinguinId} — {p.title}
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
                  {t("trendingHeading")}
                </p>
                <ul className="space-y-1 rounded-lg border border-edge bg-surface/50 p-2">
                  {payload.trending.items.length === 0 ? (
                    <li className="text-muted">—</li>
                  ) : (
                    payload.trending.items.map((p) => (
                      <li key={p.id} className="text-foreground">
                        <span className="text-faint">{t("storeId")}:</span>{" "}
                        {p.kinguinId} — {p.title}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          )}
        </section>
      </div>

      <p className="mt-6 text-center text-xs text-faint">
        Telegram: <code>/hero</code> · <code>/trending</code>
      </p>
    </div>
  );
}
