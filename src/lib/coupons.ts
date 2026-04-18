import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { discountIqdFromPercent, normalizeCouponCode } from './coupon-math';

export { discountIqdFromPercent, normalizeCouponCode };

export type CouponRecord = {
  code: string;
  /** 1–100 */
  percentOff: number;
  maxUses: number;
  usedCount: number;
  /** ISO date (UTC end of day) or null */
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
};

const FILE = path.join(process.cwd(), 'data', 'coupons.json');

async function readAll(): Promise<CouponRecord[]> {
  try {
    const raw = await readFile(FILE, 'utf8');
    const data = JSON.parse(raw) as CouponRecord[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeAll(coupons: CouponRecord[]) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, `${JSON.stringify(coupons, null, 2)}\n`, 'utf8');
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomSegment(len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return s;
}

async function uniqueCode(): Promise<string> {
  const existing = new Set((await readAll()).map((c) => c.code));
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = `GTX-${randomSegment(8)}`;
    if (!existing.has(code)) return code;
  }
  return `GTX-${randomSegment(8)}-${Date.now().toString(36).toUpperCase()}`;
}

export type CreateCouponInput = {
  percentOff: number;
  maxUses?: number;
  /** Expire after this many days from now (optional) */
  expiresInDays?: number | null;
};

export async function createCoupon(input: CreateCouponInput): Promise<CouponRecord> {
  const percentOff = Math.max(1, Math.min(100, Math.round(input.percentOff)));
  const maxUses = Math.max(1, Math.min(1_000_000, Math.floor(input.maxUses ?? 1)));
  let expiresAt: string | null = null;
  if (input.expiresInDays != null && input.expiresInDays > 0) {
    const end = new Date();
    end.setUTCDate(end.getUTCDate() + Math.floor(input.expiresInDays));
    end.setUTCHours(23, 59, 59, 999);
    expiresAt = end.toISOString();
  }
  const code = await uniqueCode();
  const now = new Date().toISOString();
  const coupon: CouponRecord = {
    code,
    percentOff,
    maxUses,
    usedCount: 0,
    expiresAt,
    active: true,
    createdAt: now,
  };
  const all = await readAll();
  all.unshift(coupon);
  await writeAll(all);
  return coupon;
}

export async function listCoupons(limit = 50): Promise<CouponRecord[]> {
  const all = await readAll();
  return all.slice(0, limit);
}

export async function getCouponByCode(code: string): Promise<CouponRecord | null> {
  const c = normalizeCouponCode(code);
  const all = await readAll();
  return all.find((x) => x.code === c) ?? null;
}

export type CouponValidation = { ok: true; percentOff: number } | { ok: false; reason: string };

export function validateCouponRecord(c: CouponRecord | null): CouponValidation {
  if (!c) return { ok: false, reason: 'not_found' };
  if (!c.active) return { ok: false, reason: 'inactive' };
  if (c.usedCount >= c.maxUses) return { ok: false, reason: 'exhausted' };
  if (c.expiresAt) {
    const exp = new Date(c.expiresAt).getTime();
    if (Date.now() > exp) return { ok: false, reason: 'expired' };
  }
  return { ok: true, percentOff: c.percentOff };
}

export async function validateCouponCode(code: string): Promise<CouponValidation> {
  const c = await getCouponByCode(code);
  return validateCouponRecord(c);
}

export async function incrementCouponUse(code: string): Promise<boolean> {
  const norm = normalizeCouponCode(code);
  const all = await readAll();
  const idx = all.findIndex((x) => x.code === norm);
  if (idx === -1) return false;
  const c = all[idx];
  if (!c.active || c.usedCount >= c.maxUses) return false;
  all[idx] = { ...c, usedCount: c.usedCount + 1 };
  await writeAll(all);
  return true;
}

export async function setCouponActive(code: string, active: boolean): Promise<CouponRecord | null> {
  const norm = normalizeCouponCode(code);
  const all = await readAll();
  const idx = all.findIndex((x) => x.code === norm);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], active };
  await writeAll(all);
  return all[idx];
}
