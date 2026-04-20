"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { ChevronDown, Zap, Monitor, Laptop, Gift, Crown } from "lucide-react";

const CATEGORIES = [
  { name: "games", key: "games", icon: <Zap size={16} /> },
  { name: "cards", key: "cards", icon: <Gift size={16} /> },
  { name: "psn", key: "psn", icon: <Crown size={16} /> },
  { name: "xbox", key: "xbox", icon: <Monitor size={16} /> },
  { name: "software", key: "software", icon: <Laptop size={16} /> },
] as const;

const FLYOUT_LINK_CLASS =
  "block rounded-md px-2 py-1.5 text-[11px] font-medium text-muted transition-all outline-none hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus-ring lg:rounded-lg lg:px-3 lg:py-2 lg:text-xs";

function categorySearchHref(key: (typeof CATEGORIES)[number]["key"]): string {
  switch (key) {
    case "games":
      return "/search?category=games";
    case "cards":
      return "/search?category=cards";
    case "software":
      return "/search?category=software";
    case "psn":
      return "/search?platform=psn";
    case "xbox":
      return "/search?platform=xbox";
    default:
      return "/search";
  }
}

function CategoryFlyoutLinks({ href }: { href: string }) {
  const t = useTranslations("Header");
  return (
    <>
      <Link href={href} className={FLYOUT_LINK_CLASS}>
        {t("latest")}
      </Link>
      <Link href={href} className={FLYOUT_LINK_CLASS}>
        {t("top")}
      </Link>
      <Link href={href} className={FLYOUT_LINK_CLASS}>
        {t("sale")}
      </Link>
    </>
  );
}

export default function NavBar() {
  const t = useTranslations("Header");
  const pathname = usePathname();
  const [mobileOpenKey, setMobileOpenKey] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpenKey(null);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpenKey == null) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMobileOpenKey(null);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close, { passive: true });
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [mobileOpenKey]);

  return (
    <nav className="relative z-[45] border-b border-edge bg-brand-dark/40 backdrop-blur-sm">
      <div
        ref={navRef}
        className="mx-auto grid max-w-7xl grid-cols-2 gap-x-2 gap-y-0 px-2 py-0.5 sm:px-3 lg:flex lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-8 lg:gap-y-2 lg:px-4 lg:py-2"
      >
        {CATEGORIES.map((cat) => {
          const href = categorySearchHref(cat.key);
          const mobileOpen = mobileOpenKey === cat.key;
          const label = t(`categories.${cat.key}`);

          return (
            <div
              key={cat.name}
              className="group relative min-w-0 py-0.5 last:max-lg:col-span-2 lg:last:col-auto lg:w-auto lg:shrink-0 lg:py-0"
            >
              <div className="flex w-full items-stretch gap-0">
                <Link
                  href={href}
                  className="flex min-h-9 min-w-0 flex-1 items-center gap-1.5 py-1 pe-0.5 text-xs font-medium text-muted transition-colors hover:text-foreground touch-manipulation sm:min-h-10 sm:py-1.5 lg:relative lg:min-h-0 lg:flex-initial lg:gap-2 lg:py-2 lg:pe-0 lg:text-sm lg:after:pointer-events-none lg:after:absolute lg:after:bottom-1 lg:after:start-0 lg:after:h-0.5 lg:after:w-full lg:after:rounded-full lg:after:bg-brand-orange lg:after:content-[''] lg:after:origin-center lg:after:scale-x-0 lg:hover:after:scale-x-100 lg:after:transition-transform lg:after:duration-200 lg:whitespace-nowrap"
                >
                  <span className="shrink-0 text-brand-orange/50 transition-colors group-hover:text-brand-orange [&_svg]:size-[14px] lg:[&_svg]:size-4">
                    {cat.icon}
                  </span>
                  <span className="min-w-0 leading-tight">{label}</span>
                  <ChevronDown
                    size={14}
                    className="ms-0.5 hidden opacity-60 transition-transform duration-300 group-hover:rotate-180 lg:inline"
                    aria-hidden
                  />
                </Link>
                <button
                  type="button"
                  className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-white/5 hover:text-foreground sm:min-h-10 sm:min-w-10 lg:hidden touch-manipulation"
                  aria-expanded={mobileOpen}
                  aria-controls={`nav-cat-${cat.key}`}
                  aria-label={`${label} — ${t("openSubmenu")}`}
                  onClick={() =>
                    setMobileOpenKey((k) => (k === cat.key ? null : cat.key))
                  }
                >
                  <ChevronDown
                    size={14}
                    className={`opacity-70 transition-transform duration-300 ${mobileOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
              </div>

              <div
                id={`nav-cat-${cat.key}`}
                role="region"
                className={`relative z-[60] mt-0.5 w-full rounded-lg border border-edge bg-surface-elevated p-1.5 shadow-md shadow-black/20 ring-1 ring-white/[0.04] lg:hidden ${mobileOpen ? "block" : "hidden"}`}
              >
                <CategoryFlyoutLinks href={href} />
              </div>

              <div className="invisible absolute top-full z-50 mt-1 hidden w-48 translate-y-2 rounded-xl border border-edge bg-surface-elevated p-2 opacity-0 shadow-xl shadow-black/30 ring-1 ring-white/[0.04] transition-all duration-300 ltr:left-0 rtl:right-0 lg:block group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                <CategoryFlyoutLinks href={href} />
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
