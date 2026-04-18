"use client";

import React from "react";
import { storefrontImageSrc } from "@/lib/storefront-image";

type Props = {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
};

/** بطاقة المنتج — الصور الخارجية تُحمَّل عبر بروكسي الموقع لتجاوز حظر الـ CDN. */
export default function CatalogCardImage({
  src,
  alt,
  className = "",
  loading = "lazy",
  fetchPriority,
}: Props) {
  const resolved = storefrontImageSrc(src);
  return (
    <span className={`isolate min-h-0 min-w-0 overflow-hidden ${className}`}>
      <img
        src={resolved}
        alt={alt}
        loading={loading}
        decoding="async"
        className="absolute inset-0 z-[1] h-full w-full object-cover object-center"
        {...(fetchPriority ? { fetchPriority } : {})}
      />
    </span>
  );
}
