import { NextRequest, NextResponse } from "next/server";
import "@/lib/load-env";
import {
  HERO_CAROUSEL_MAX,
  getHeroCacheTtlSeconds,
  getHeroProductIds,
  setHeroProductIds,
} from "@/lib/hero-products";
import {
  TRENDING_HOME_MAX,
  getTrendingProductIds,
  setTrendingProductIds,
} from "@/lib/trending-products";
import { getCachedHeroHomeItems, getCachedHomeTrendingItems } from "@/lib/home-feed";
import type { StoreProduct } from "@/lib/store-product";

function adminSecret(): string | null {
  const s = process.env.HOME_FEED_ADMIN_SECRET?.trim();
  return s && s.length > 0 ? s : null;
}

function tokenFromRequest(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer "))
    return auth.slice(7).trim() || null;
  return req.nextUrl.searchParams.get("secret")?.trim() ?? null;
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function serviceUnavailable() {
  return NextResponse.json(
    { error: "HOME_FEED_ADMIN_SECRET is not set on the server." },
    { status: 503 },
  );
}

function normalizeIdInput(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .flatMap((x) => String(x).split(/[\s,\n]+/))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[\s,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function productSummary(p: StoreProduct) {
  return {
    id: p.id,
    kinguinId: p.kinguinId,
    title: p.title,
    price: p.price,
  };
}

export async function GET(req: NextRequest) {
  const expected = adminSecret();
  if (!expected) return serviceUnavailable();
  const token = tokenFromRequest(req);
  if (token !== expected) return unauthorized();

  try {
    const [
      heroIds,
      trendingIds,
      cacheTtlSeconds,
      heroItems,
      trendingItems,
    ] = await Promise.all([
      getHeroProductIds(),
      getTrendingProductIds(),
      getHeroCacheTtlSeconds(),
      getCachedHeroHomeItems(),
      getCachedHomeTrendingItems(),
    ]);

    return NextResponse.json({
      hero: {
        ids: heroIds,
        max: HERO_CAROUSEL_MAX,
        items: heroItems.map(productSummary),
      },
      trending: {
        ids: trendingIds,
        max: TRENDING_HOME_MAX,
        items: trendingItems.map(productSummary),
      },
      cacheTtlSeconds,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const expected = adminSecret();
  if (!expected) return serviceUnavailable();
  const token = tokenFromRequest(req);
  if (token !== expected) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hasHero = Object.prototype.hasOwnProperty.call(body, "heroIds");
  const hasTrending = Object.prototype.hasOwnProperty.call(body, "trendingIds");
  if (!hasHero && !hasTrending) {
    return NextResponse.json(
      { error: "Provide heroIds and/or trendingIds" },
      { status: 400 },
    );
  }

  try {
    let heroIds: string[] | undefined;
    let trendingIds: string[] | undefined;
    if (hasHero) {
      heroIds = await setHeroProductIds(normalizeIdInput(body.heroIds));
    }
    if (hasTrending) {
      trendingIds = await setTrendingProductIds(
        normalizeIdInput(body.trendingIds),
      );
    }

    return NextResponse.json({
      ok: true,
      heroIds: heroIds ?? (await getHeroProductIds()),
      trendingIds: trendingIds ?? (await getTrendingProductIds()),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
