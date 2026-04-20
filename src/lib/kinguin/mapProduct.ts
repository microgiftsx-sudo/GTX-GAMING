import type { KinguinProductJson } from './types';

const BASE = 'https://gateway.kinguin.net/esa/api/v1';

export function normalizePlatformSlug(platform: string | undefined): 'steam' | 'psn' | 'xbox' | 'pc' {
  const s = (platform ?? '').toLowerCase();
  if (s.includes('steam')) return 'steam';
  if (s.includes('playstation') || s.includes('psn') || s.includes('ps4') || s.includes('ps5')) return 'psn';
  if (s.includes('xbox')) return 'xbox';
  return 'pc';
}

export function deriveCategorySlug(tags: string[] | undefined): 'games' | 'cards' | 'software' | 'dlc' {
  const t = new Set((tags ?? []).map((x) => x.toLowerCase()));
  if (t.has('prepaid')) return 'cards';
  if (t.has('software')) return 'software';
  if (t.has('dlc')) return 'dlc';
  return 'games';
}

function pickImageUrl(p: KinguinProductJson): string | null {
  const cover = p.images?.cover?.url ?? p.images?.cover?.thumbnail;
  if (cover) return cover;
  const shot = p.images?.screenshots?.[0];
  return shot?.url ?? shot?.thumbnail ?? null;
}

/** Normalized fields from Kinguin API JSON (EUR prices, slugs, image URL). */
export function mapKinguinJson(p: KinguinProductJson) {
  const imageUrl = pickImageUrl(p);
  const tags = p.tags ?? [];
  const genres = p.genres ?? [];
  /** Do not derive “original” list price from other merchants’ offers — main `price` only. */
  const original: number | null = null;

  let updatedAt: Date | null = null;
  if (p.updatedAt) {
    const d = new Date(p.updatedAt);
    if (!Number.isNaN(d.getTime())) updatedAt = d;
  }

  return {
    kinguinId: p.kinguinId,
    productId: p.productId ?? null,
    name: p.name,
    description: p.description ?? null,
    platform: p.platform ?? null,
    platformSlug: normalizePlatformSlug(p.platform),
    categorySlug: deriveCategorySlug(tags),
    priceEur: p.price,
    originalPriceEur: original,
    imageUrl,
    tags,
    genres,
    regionalLimitations: p.regionalLimitations ?? null,
    updatedAtKinguin: updatedAt,
  };
}

export { BASE };
