import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidateTag } from "next/cache";
import { getDataRoot } from "@/lib/data-root";

const FILE = path.join(getDataRoot(), "catalog-sources.json");

/** Next.js cache tag — busted when Telegram /sources updates flags */
export const CATALOG_LISTING_TAG = "catalog-listing";

export type CatalogSourcesState = {
  kinguin: boolean;
  plati: boolean;
};

const DEFAULT: CatalogSourcesState = { kinguin: true, plati: true };

function normalize(raw: unknown): CatalogSourcesState {
  if (!raw || typeof raw !== "object") return { ...DEFAULT };
  const o = raw as Record<string, unknown>;
  return {
    kinguin: o.kinguin === false ? false : true,
    plati: o.plati === false ? false : true,
  };
}

export async function getCatalogSources(): Promise<CatalogSourcesState> {
  try {
    const text = await readFile(FILE, "utf-8");
    return normalize(JSON.parse(text) as unknown);
  } catch {
    return { ...DEFAULT };
  }
}

export async function setCatalogSources(
  patch: Partial<CatalogSourcesState>,
): Promise<CatalogSourcesState> {
  const cur = await getCatalogSources();
  const next: CatalogSourcesState = {
    kinguin: patch.kinguin ?? cur.kinguin,
    plati: patch.plati ?? cur.plati,
  };
  if (!next.kinguin && !next.plati) {
    throw new Error("At least one of kinguin or plati must stay enabled.");
  }
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
  try {
    revalidateTag(CATALOG_LISTING_TAG, { expire: 0 });
  } catch {
    /* revalidateTag may throw outside a request context */
  }
  return next;
}
