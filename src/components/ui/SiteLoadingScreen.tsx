"use client";

import React from "react";
import { useTranslations } from "next-intl";

type Phase = "default" | "images";

type Props = {
  /** `images` = after JSON loaded, while gallery assets preload */
  phase?: Phase;
  className?: string;
};

export default function SiteLoadingScreen({ phase = "default", className = "" }: Props) {
  const ui = useTranslations("UI");
  const label = phase === "images" ? ui("loadingImages") : ui("pageLoading");

  return (
    <div
      className={`flex flex-col items-center justify-center gap-6 px-6 py-12 ${className}`}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <img
        src="/icons/logo.png"
        alt=""
        width={96}
        height={96}
        className="h-20 w-20 object-contain md:h-24 md:w-24"
        aria-hidden
      />
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-10 w-10 rounded-full border-2 border-white/15 border-t-brand-orange animate-spin md:h-11 md:w-11"
          aria-hidden
        />
        <p className="text-center text-sm font-medium text-muted md:text-base">{label}</p>
      </div>
    </div>
  );
}
