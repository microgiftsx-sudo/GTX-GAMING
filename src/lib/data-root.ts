import path from 'node:path';

/**
 * Persistent JSON + uploads directory.
 * On Railway: add a volume, mount it (e.g. `/data`), set `DATA_DIR=/data` in Variables.
 * Defaults to `./data` under the app cwd for local dev.
 */
export function getDataRoot(): string {
  const raw = process.env.DATA_DIR?.trim();
  if (raw) return path.resolve(raw);
  return path.join(process.cwd(), 'data');
}

/** Receipt images saved with orders — same volume as bot state when `DATA_DIR` is set. */
export function getReceiptsDir(): string {
  return path.join(getDataRoot(), 'uploads', 'receipts');
}
