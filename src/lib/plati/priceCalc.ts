const DEFAULT_DIGISELLER_BASE =
  process.env.DIGISELLER_API_BASE_URL?.trim() || 'https://api.digiseller.com';

export type DigisellerCalcResponse = {
  retval: number;
  retdesc?: string;
  data?: {
    price?: number;
    amount?: number;
    currency?: string;
    count?: number;
  };
};

/**
 * GET https://api.digiseller.com/api/products/price/calc
 * — `options[]` pairs as `optionId:valueId`.
 */
export async function digisellerCalcPriceEur(params: {
  productId: number;
  selections: { optionId: number; valueId: number }[];
  count?: number;
}): Promise<{ ok: true; eur: number } | { ok: false; message: string }> {
  const base = DEFAULT_DIGISELLER_BASE.replace(/\/$/, '');
  const u = new URL(`${base}/api/products/price/calc`);
  u.searchParams.set('product_id', String(params.productId));
  u.searchParams.set('currency', 'EUR');
  u.searchParams.set('count', String(params.count ?? 1));
  u.searchParams.set('format', 'json');
  u.searchParams.set('transp', 'cors');
  const token = process.env.DIGISELLER_API_TOKEN?.trim();
  if (token) u.searchParams.set('token', token);

  for (const s of params.selections) {
    u.searchParams.append('options[]', `${s.optionId}:${s.valueId}`);
  }

  const res = await fetch(u.toString(), {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return { ok: false, message: `Digiseller calc ${res.status}: ${t.slice(0, 200)}` };
  }
  const json = (await res.json()) as DigisellerCalcResponse;
  if (json.retval !== 0) {
    return { ok: false, message: json.retdesc ?? `retval ${json.retval}` };
  }
  const amount = json.data?.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: 'Invalid calc response' };
  }
  return { ok: true, eur: amount };
}
