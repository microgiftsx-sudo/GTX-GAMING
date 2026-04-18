"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Placeholder height to reduce CLS before content mounts */
  minHeight?: string;
  className?: string;
  /** Expand the viewport band so content starts loading slightly before it enters view */
  rootMargin?: string;
};

/**
 * Mounts children only after the placeholder intersects the viewport.
 * Use for below-the-fold sections to defer JS, data fetching, and heavy DOM on mobile.
 */
export default function LazyWhenVisible({
  children,
  minHeight = "min-h-[200px]",
  className = "",
  rootMargin = "100px 0px",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShow(true);
          obs.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className}>
      {show ? (
        children
      ) : (
        <div
          className={`${minHeight} animate-pulse rounded-2xl bg-surface-elevated/80`}
          aria-hidden
        />
      )}
    </div>
  );
}
