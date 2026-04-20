const PLACEHOLDER =
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&w=600&q=60';

/** Hosts we may fetch through /api/media/image (SSRF-safe allowlist). */
export function isAllowedImageHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'images.unsplash.com') return true;
  if (h.endsWith('.kinguin.net')) return true;
  if (h.endsWith('.kinguin.com')) return true;
  /* بعض روابط المنتجات من شبكات CDN تابعة لكينجوين */
  if (h.endsWith('.kinguinusercontent.com')) return true;
  /* أغلفة ألعاب Steam وغيرها يعيدها Kinguin أحياناً من CDN ستيم */
  if (h === 'steamstatic.com' || h.endsWith('.steamstatic.com')) return true;
  /* Plati / Digiseller marketplace imagery */
  if (h === 'graph.digiseller.com' || h.endsWith('.digiseller.com')) return true;
  if (h === 'digiseller.mycdn.ink' || h.endsWith('.digiseller.mycdn.ink')) return true;
  if (h === 'plati.market' || h.endsWith('.plati.market')) return true;
  return false;
}

export function normalizeImageUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (t.startsWith('//')) return `https:${t}`;
  return t;
}

/**
 * يمرّر صور Kinguin/Unsplash عبر بروكسي الموقع حتى تظهر في المتصفح حتى لو حظر الـ CDN الروابط المباشرة من الواجهات.
 */
export function storefrontImageSrc(src: string | undefined | null): string {
  if (!src?.trim()) return PLACEHOLDER;
  const s = src.trim();
  if (s.startsWith('/api/media/image')) return s;
  const normalized = normalizeImageUrl(s);
  try {
    const u = new URL(normalized);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return PLACEHOLDER;
    if (isAllowedImageHost(u.hostname)) {
      return `/api/media/image?url=${encodeURIComponent(normalized)}`;
    }
    return normalized;
  } catch {
    return PLACEHOLDER;
  }
}
