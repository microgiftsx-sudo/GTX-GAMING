import type { KinguinProductJson, KinguinSearchResponse } from './types';
import { BASE } from './mapProduct';

function getApiKey(): string {
  const k = process.env.KINGUIN_API_KEY;
  if (!k?.trim()) {
    throw new Error('KINGUIN_API_KEY is not set');
  }
  return k.trim();
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function kinguinFetch<T>(path: string, init?: RequestInit & { retries?: number }): Promise<T> {
  const retries = init?.retries ?? 4;
  const { retries: _r, ...rest } = init ?? {};
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      ...rest,
      cache: 'no-store',
      headers: {
        'X-Api-Key': getApiKey(),
        Accept: 'application/json',
        ...rest?.headers,
      },
    });

    if (res.status === 429) {
      const wait = 500 * Math.pow(2, attempt);
      await sleep(wait);
      lastErr = new Error(`Kinguin 429 rate limited (retry ${attempt + 1})`);
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Kinguin ${res.status}: ${text.slice(0, 200)}`);
    }

    return res.json() as Promise<T>;
  }

  throw lastErr instanceof Error ? lastErr : new Error('Kinguin request failed after retries');
}

export type FetchProductsParams = {
  page: number;
  limit?: number;
  sortBy?: 'kinguinId' | 'updatedAt';
  sortType?: 'asc' | 'desc';
  /** Min length 3 per Kinguin API; caller should omit if shorter. */
  name?: string;
  /** Comma-separated platform slugs (e.g. steam,pc). */
  platform?: string;
  /** Comma-separated tags (e.g. prepaid,software). */
  tags?: string;
  /** EUR — API marks as deprecated but still used for filtering when supported. */
  priceFrom?: number;
  priceTo?: number;
};

export async function fetchProductsPage(
  params: FetchProductsParams,
): Promise<KinguinSearchResponse> {
  const limit = Math.min(params.limit ?? 100, 100);
  const sp = new URLSearchParams();
  sp.set('page', String(params.page));
  sp.set('limit', String(limit));
  sp.set('sortBy', params.sortBy ?? 'updatedAt');
  sp.set('sortType', params.sortType ?? 'desc');
  if (params.name && params.name.trim().length >= 3) {
    sp.set('name', params.name.trim());
  }
  if (params.platform?.trim()) {
    sp.set('platform', params.platform.trim());
  }
  if (params.tags?.trim()) {
    sp.set('tags', params.tags.trim());
  }
  if (
    params.priceFrom != null &&
    Number.isFinite(params.priceFrom) &&
    params.priceFrom >= 0
  ) {
    sp.set('priceFrom', String(params.priceFrom));
  }
  if (
    params.priceTo != null &&
    Number.isFinite(params.priceTo) &&
    params.priceTo >= 0
  ) {
    sp.set('priceTo', String(params.priceTo));
  }

  return kinguinFetch<KinguinSearchResponse>(`/products?${sp.toString()}`);
}

/** Single product — `GET /products/{kinguinId}` */
export async function fetchProductByKinguinId(
  kinguinId: number,
): Promise<KinguinProductJson> {
  return kinguinFetch<KinguinProductJson>(`/products/${kinguinId}`);
}
