import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { revalidateTag } from 'next/cache';
import { getDataRoot } from '@/lib/data-root';
import { CATALOG_LISTING_CACHE_TAG } from '@/lib/catalog-cache-tags';
import { HERO_CAROUSEL_CACHE_TAG } from '@/lib/hero-products';
import { TRENDING_HOME_CACHE_TAG } from '@/lib/trending-products';

export type CatalogProvider = 'kinguin' | 'plati';

const FILE = path.join(getDataRoot(), 'catalog-provider.json');

type FileShape = { provider: CatalogProvider };

function isProvider(x: unknown): x is CatalogProvider {
  return x === 'kinguin' || x === 'plati';
}

export async function getCatalogProvider(): Promise<CatalogProvider> {
  try {
    const raw = await readFile(FILE, 'utf8');
    const data = JSON.parse(raw) as FileShape;
    if (isProvider(data.provider)) return data.provider;
  } catch {
    /* missing or invalid */
  }
  return 'kinguin';
}

/** Expire tagged caches so listing, hero, and trending refetch after a provider switch. */
export function revalidateAllCatalogCaches(): void {
  for (const tag of [CATALOG_LISTING_CACHE_TAG, HERO_CAROUSEL_CACHE_TAG, TRENDING_HOME_CACHE_TAG]) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch {
      /* revalidateTag may throw outside a request context */
    }
  }
}

export async function setCatalogProvider(provider: CatalogProvider): Promise<CatalogProvider> {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, `${JSON.stringify({ provider }, null, 2)}\n`, 'utf8');
  revalidateAllCatalogCaches();
  return provider;
}
