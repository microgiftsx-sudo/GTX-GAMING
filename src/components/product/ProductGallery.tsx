"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import CatalogCardImage from "@/components/ui/CatalogCardImage";

type Props = {
  title: string;
  galleryUrls: string[];
  youtubeIds: string[];
};

export default function ProductGallery({ title, galleryUrls, youtubeIds }: Props) {
  const t = useTranslations("Product");
  const urls = useMemo(() => galleryUrls.filter(Boolean), [galleryUrls]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive((i) => (urls.length === 0 ? 0 : Math.min(i, urls.length - 1)));
  }, [urls.length]);

  const safeIndex = urls.length === 0 ? 0 : Math.min(active, urls.length - 1);
  const mainSrc = urls[safeIndex];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="relative aspect-[2/3] w-full max-h-[min(38vh,260px)] overflow-hidden rounded-2xl border border-edge bg-black/40 ring-1 ring-white/[0.04] sm:max-h-[min(48vh,380px)] md:max-h-[480px] md:rounded-3xl md:aspect-[16/10]">
        {mainSrc ? (
          <CatalogCardImage
            src={mainSrc}
            alt={title}
            loading="eager"
            fetchPriority="high"
            className="absolute inset-0 size-full"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-dark/80 via-brand-dark/20 to-brand-dark/40" />
      </div>

      {urls.length > 1 && (
        <div
          className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] md:gap-3"
          role="list"
        >
          {urls.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              role="listitem"
              onClick={() => setActive(i)}
              className={`relative aspect-[2/3] h-16 w-auto shrink-0 overflow-hidden rounded-lg border-2 transition-all sm:h-20 md:h-24 md:rounded-xl ${
                safeIndex === i
                  ? "border-brand-orange ring-2 ring-brand-orange/30"
                  : "border-edge opacity-80 hover:border-white/25 hover:opacity-100"
              }`}
            >
              <CatalogCardImage src={url} alt="" className="absolute inset-0 size-full" />
            </button>
          ))}
        </div>
      )}

      {youtubeIds.length > 0 && (
        <section className="space-y-3 md:space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted md:text-base">
            {t("videosHeading")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-1">
            {youtubeIds.map((id) => (
              <div
                key={id}
                className="relative aspect-video w-full overflow-hidden rounded-xl border border-edge bg-black shadow-lg ring-1 ring-white/[0.04] md:rounded-2xl"
              >
                <iframe
                  title={`${title} — video`}
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
