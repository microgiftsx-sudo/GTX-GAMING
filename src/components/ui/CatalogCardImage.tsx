import React from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
};

/** Uniform card art: fixed frame + `object-cover` (no stretched backgrounds). */
export default function CatalogCardImage({
  src,
  alt,
  className = "",
  loading = "lazy",
  fetchPriority,
}: Props) {
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      {...(fetchPriority ? { fetchPriority } : {})}
      className={`object-cover object-center ${className}`}
    />
  );
}
