/** Client-safe discount math (no I/O). */

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function discountIqdFromPercent(totalAfterTaxIqd: number, percentOff: number): number {
  const t = Math.max(0, Math.round(totalAfterTaxIqd));
  const p = Math.max(0, Math.min(100, percentOff));
  return Math.round((t * p) / 100);
}
