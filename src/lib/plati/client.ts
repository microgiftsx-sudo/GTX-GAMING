/**
 * Plati public search + Digiseller product JSON (marketplace catalog).
 *
 * Search (no API key): `GET https://plati.io/api/search.ashx?query=...&pagenum=&pagesize=&visibleOnly=true&response=json`
 * — returns `items[]` with `id`, `seller_id`, `price_eur`, `name_eng`, `description_eng`, `image`, `url`, `section_id`, optional `sale_info`.
 *
 * Product detail (no token required for public goods): official Digiseller
 * `GET https://api.digiseller.com/api/products/{product_id}/data?currency=EUR&lang=en-US&format=json&transp=cors`
 * — optional `seller_id` for cart-related fields; `retval !== 0` when the product is missing.
 *
 * Rate limits: not documented in the HTML we mirrored; use modest concurrency and retries on 429 only.
 */

const DEFAULT_PLATI_SEARCH =
  process.env.PLATI_SEARCH_URL?.trim() || 'https://plati.io/api/search.ashx';

const DEFAULT_DIGISELLER_BASE =
  process.env.DIGISELLER_API_BASE_URL?.trim() || 'https://api.digiseller.com';

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type PlatiSearchItem = {
  id: number;
  name?: string;
  name_eng?: string;
  price_eur: number;
  price_usd?: number;
  section_id?: number;
  url?: string;
  description?: string;
  description_eng?: string;
  image?: string;
  seller_id?: number;
  seller_name?: string;
  sale_info?: {
    common_price_eur?: string | number;
    common_price_usd?: string | number;
    sale_percent?: string | number;
  };
};

type PlatiSearchResponse = {
  Pagenum?: number;
  Pagesize?: number;
  Totalpages?: number;
  total?: number;
  items?: PlatiSearchItem[] | null;
};

export type DigisellerProductData = {
  retval: number;
  retdesc?: string;
  product?: Record<string, unknown>;
};

function platiSearchUrl(): URL {
  return new URL(DEFAULT_PLATI_SEARCH);
}

export async function fetchPlatiSearchPage(params: {
  query: string;
  page: number;
  pageSize: number;
}): Promise<PlatiSearchResponse> {
  const u = platiSearchUrl();
  u.searchParams.set('query', params.query);
  u.searchParams.set('pagenum', String(params.page));
  u.searchParams.set('pagesize', String(params.pageSize));
  u.searchParams.set('visibleOnly', 'true');
  u.searchParams.set('response', 'json');

  let lastErr: unknown;
  for (let attempt = 0; attempt <= 3; attempt++) {
    const res = await fetch(u.toString(), {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (res.status === 429) {
      await sleep(400 * Math.pow(2, attempt));
      lastErr = new Error(`Plati search 429 (retry ${attempt + 1})`);
      continue;
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Plati search ${res.status}: ${t.slice(0, 200)}`);
    }
    return res.json() as Promise<PlatiSearchResponse>;
  }
  throw lastErr instanceof Error ? lastErr : new Error('Plati search failed after retries');
}

export async function fetchDigisellerProductData(
  productId: number,
): Promise<DigisellerProductData> {
  const base = DEFAULT_DIGISELLER_BASE.replace(/\/$/, '');
  const u = new URL(`${base}/api/products/${productId}/data`);
  u.searchParams.set('currency', 'EUR');
  u.searchParams.set('lang', 'en-US');
  u.searchParams.set('format', 'json');
  u.searchParams.set('transp', 'cors');
  const token = process.env.DIGISELLER_API_TOKEN?.trim();
  if (token) u.searchParams.set('token', token);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= 3; attempt++) {
    const res = await fetch(u.toString(), {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (res.status === 429) {
      await sleep(500 * Math.pow(2, attempt));
      lastErr = new Error(`Digiseller 429 (retry ${attempt + 1})`);
      continue;
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Digiseller ${res.status}: ${t.slice(0, 200)}`);
    }
    return res.json() as Promise<DigisellerProductData>;
  }
  throw lastErr instanceof Error ? lastErr : new Error('Digiseller request failed after retries');
}
