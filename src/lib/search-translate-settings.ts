import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { revalidateTag } from 'next/cache';
import { CATALOG_LISTING_CACHE_TAG } from '@/lib/catalog-cache-tags';
import { getDataRoot } from '@/lib/data-root';

const FILE = path.join(getDataRoot(), 'search-translate.json');

export type SearchTranslateMode = 'full' | 'dictionary';

export type SearchTranslateSettings = {
  enabled: boolean;
  mode: SearchTranslateMode;
  /** Optional; sent to MyMemory as `de` for higher free quota per their docs. */
  myMemoryEmail: string;
};

const DEFAULTS: SearchTranslateSettings = {
  enabled: true,
  mode: 'full',
  myMemoryEmail: '',
};

function coerceMode(x: unknown): SearchTranslateMode {
  const s = typeof x === 'string' ? x.toLowerCase().trim() : '';
  if (s === 'dictionary' || s === 'dict' || s === 'manual') return 'dictionary';
  return 'full';
}

function mergeDiskShape(o: Record<string, unknown>): SearchTranslateSettings {
  const enabled =
    typeof o.enabled === 'boolean'
      ? o.enabled
      : typeof o.enabled === 'string'
        ? o.enabled.toLowerCase() === 'true' || o.enabled === '1'
        : DEFAULTS.enabled;
  const mode = o.mode !== undefined ? coerceMode(o.mode) : DEFAULTS.mode;
  const myMemoryEmail =
    typeof o.myMemoryEmail === 'string'
      ? o.myMemoryEmail.trim().slice(0, 120)
      : DEFAULTS.myMemoryEmail;
  return { enabled, mode, myMemoryEmail };
}

let mem: { at: number; val: SearchTranslateSettings } | null = null;
const MEM_TTL_MS = 4000;

function invalidateMem() {
  mem = null;
}

export async function getSearchTranslateSettings(): Promise<SearchTranslateSettings> {
  if (mem && Date.now() - mem.at < MEM_TTL_MS) return mem.val;
  try {
    const raw = await readFile(FILE, 'utf8');
    const o = JSON.parse(raw) as Record<string, unknown>;
    const val = mergeDiskShape(o);
    mem = { at: Date.now(), val };
    return val;
  } catch {
    const val = { ...DEFAULTS };
    mem = { at: Date.now(), val };
    return val;
  }
}

export async function setSearchTranslateSettings(
  patch: Partial<SearchTranslateSettings>,
): Promise<SearchTranslateSettings> {
  const cur = await getSearchTranslateSettings();
  const next: SearchTranslateSettings = {
    enabled: patch.enabled !== undefined ? patch.enabled : cur.enabled,
    mode: patch.mode !== undefined ? coerceMode(patch.mode) : cur.mode,
    myMemoryEmail:
      patch.myMemoryEmail !== undefined
        ? patch.myMemoryEmail.trim().slice(0, 120)
        : cur.myMemoryEmail,
  };
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  invalidateMem();
  try {
    revalidateTag(CATALOG_LISTING_CACHE_TAG, { expire: 0 });
  } catch {
    /* revalidateTag may throw outside a request context */
  }
  return next;
}
