/**
 * Calendar date in Asia/Baghdad (YYYY-MM-DD).
 * Used to bucket server caches so catalog listings stay stable for a full local day.
 */
export function getBaghdadDayKey(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baghdad",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
