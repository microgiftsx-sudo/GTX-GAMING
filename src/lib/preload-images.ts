/**
 * Warm the browser cache for remote images. Resolves when all load (or fail)
 * or when `timeoutMs` elapses — never rejects.
 */
export function preloadImageUrls(
  urls: string[],
  options?: { timeoutMs?: number },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 18_000;
  const unique = Array.from(
    new Set(urls.map((u) => u.trim()).filter(Boolean)),
  );
  if (unique.length === 0) return Promise.resolve();

  const loadOne = (url: string) =>
    new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (typeof img.decode === "function") {
          img.decode().then(() => resolve()).catch(() => resolve());
        } else {
          resolve();
        }
      };
      img.onerror = () => resolve();
      img.src = url;
    });

  const all = Promise.all(unique.map(loadOne)).then(() => undefined);
  const timeout = new Promise<void>((r) => {
    setTimeout(r, timeoutMs);
  });
  return Promise.race([all, timeout]);
}
