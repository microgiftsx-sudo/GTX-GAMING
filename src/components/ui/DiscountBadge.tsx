"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
  /** على بطاقة المنتج (زاوية الصورة) */
  variant?: "card" | "inline";
  className?: string;
};

/** شارة خصم عالية الوضوح: خط أكبر، خلفية صلبة، ظل وحد بصري. */
export default function DiscountBadge({
  children,
  variant = "card",
  className = "",
}: Props) {
  const base =
    "inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-brand-purple font-extrabold tabular-nums tracking-tight text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] ring-2 ring-white/35 [text-shadow:0_1px_2px_rgba(0,0,0,0.85)]";

  if (variant === "inline") {
    return (
      <span
        dir="ltr"
        className={`${base} px-3 py-1.5 text-sm sm:text-base md:px-4 md:py-2 md:text-lg ${className}`}
        lang="en"
        translate="no"
      >
        {children}
      </span>
    );
  }

  return (
    <div
      dir="ltr"
      className={`absolute end-2 top-2 z-10 min-h-[36px] min-w-[3.5rem] px-3 py-1.5 text-sm sm:end-3 sm:top-3 sm:min-h-[38px] sm:min-w-[3.75rem] sm:px-3.5 sm:py-2 sm:text-base md:text-lg ${base} ${className}`}
      lang="en"
      translate="no"
    >
      {children}
    </div>
  );
}
