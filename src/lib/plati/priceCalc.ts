const DIGISELLER_API_BASE = 'https://api.digiseller.com';

export type DigisellerCalcResponse = {
  retval: number;
  retdesc?: string;
  data?: {
    price?: number | string;
    amount?: number | string;
    currency?: string;
    count?: number;
  };
};

function parsePositiveEur(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/\s+/g, '').replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function readCalcEurFromData(data: DigisellerCalcResponse['data']): number | undefined {
  if (!data) return undefined;
  return (
    parsePositiveEur(data.amount) ??
    parsePositiveEur(data.price) ??
    undefined
  );
}

/**
 * GET https://api.digiseller.com/api/products/price/calc
 * — `options[]` pairs as `optionId:valueId`.
 *
 * Non-fixed (`unit`) goods require `unit_cnt` per Digiseller docs; fixed-price goods use `count`.
 */
export async function digisellerCalcPriceEur(params: {
  productId: number;
  selections: { optionId: number; valueId: number }[];
  /** Fixed-price quantity (default 1). Ignored when `unitCnt` is set. */
  count?: number;
  /** Non-fixed price quantity — sent as `unit_cnt` when set. */
  unitCnt?: number;
}): Promise<{ ok: true; eur: number } | { ok: false; message: string }> {
  const base = DIGISELLER_API_BASE.replace(/\/$/, '');
  const u = new URL(`${base}/api/products/price/calc`);
  u.searchParams.set('product_id', String(params.productId));
  u.searchParams.set('currency', 'EUR');
  if (params.unitCnt != null && params.unitCnt > 0) {
    u.searchParams.set('unit_cnt', String(params.unitCnt));
  } else {
    u.searchParams.set('count', String(params.count ?? 1));
  }
  u.searchParams.set('format', 'json');
  u.searchParams.set('transp', 'cors');

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
  const eur = readCalcEurFromData(json.data);
  if (eur == null) {
    return { ok: false, message: 'Invalid calc response' };
  }
  return { ok: true, eur };
}
