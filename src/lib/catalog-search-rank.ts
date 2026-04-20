import type { StoreProduct } from '@/lib/store-product';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Relevance sort for storefront search: strong title matches first (phrase, whole words,
 * substring), then weaker matches. Works on one page or merged multi-page results.
 */
export function rankCatalogSearchResults(items: StoreProduct[], query: string): StoreProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...items].sort((a, b) => b.kinguinId - a.kinguinId);
  }

  const tokens = q.split(/\s+/).filter((t) => t.length > 0);

  function score(p: StoreProduct): number {
    const title = p.title.toLowerCase();
    let s = 0;

    if (title.includes(q)) {
      s += 1200;
      if (title.startsWith(q)) s += 400;
      else {
        const idx = title.indexOf(q);
        if (idx === 0) s += 400;
        else if (idx > 0) {
          const before = title[idx - 1];
          if (!/[a-z0-9\u0600-\u06FF]/.test(before)) s += 320;
          else s += 260;
        }
      }
    }

    for (const tok of tokens) {
      if (tok.length < 2) continue;
      const boundary = new RegExp(`(^|[^a-z0-9\u0600-\u06FF])${escapeRe(tok)}([^a-z0-9\u0600-\u06FF]|$)`, 'i');
      if (boundary.test(title)) {
        s += 280;
        if (new RegExp(`^${escapeRe(tok)}`, 'i').test(title.trim())) s += 120;
      } else if (title.includes(tok)) {
        s += 220;
      }
    }

    if (tokens.length > 0 && title.startsWith(tokens[0]!)) {
      s += 100;
    }

    return s;
  }

  return [...items].sort((a, b) => {
    const d = score(b) - score(a);
    if (d !== 0) return d;
    return b.kinguinId - a.kinguinId;
  });
}

export function sortCatalogItems(
  items: StoreProduct[],
  sort: string,
  query: string,
): StoreProduct[] {
  if (sort === 'price-low') {
    return [...items].sort((a, b) => a.price - b.price || b.kinguinId - a.kinguinId);
  }
  if (sort === 'price-high') {
    return [...items].sort((a, b) => b.price - a.price || b.kinguinId - a.kinguinId);
  }
  if (query.trim().length >= 2) {
    return rankCatalogSearchResults(items, query);
  }
  return [...items].sort((a, b) => b.kinguinId - a.kinguinId);
}
