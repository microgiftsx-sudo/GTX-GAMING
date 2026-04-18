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

/** When list prices are VAT-inclusive (gross), extract net (ex-VAT) amount. */
export function netFromGrossIqd(grossIqd: number, ratePercent: number): number {
  const gross = Math.round(grossIqd);
  if (ratePercent <= 0) return gross;
  return Math.round(gross / (1 + ratePercent / 100));
}
