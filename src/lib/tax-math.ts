/** Pure VAT math (no I/O). Used by server, client, and Telegram. */

export function applyTaxToBaseIqd(baseIqd: number, ratePercent: number): number {
  const base = Math.round(baseIqd);
  if (ratePercent <= 0) return base;
  return Math.round(base * (1 + ratePercent / 100));
}

export function taxAmountFromBase(baseIqd: number, ratePercent: number): number {
  const base = Math.round(baseIqd);
  return applyTaxToBaseIqd(base, ratePercent) - base;
}
