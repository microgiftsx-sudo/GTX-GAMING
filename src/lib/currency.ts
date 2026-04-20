/**
 * IQD is the base cart currency. Rates match CartContext RATES for display consistency.
 * EUR_PER_IQD = 0.00062 means 1 IQD = 0.00062 EUR, so 1 EUR = 1/0.00062 IQD.
 */
export const EUR_PER_IQD = 0.00062;

export function eurToIqd(eur: number): number {
  if (!Number.isFinite(eur) || eur <= 0) return 0;
  return eur / EUR_PER_IQD;
}

export function iqdToEur(iqd: number): number {
  return iqd * EUR_PER_IQD;
}
