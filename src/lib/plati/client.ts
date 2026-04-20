import { XMLParser } from "fast-xml-parser";
import type { PlatiGoodsListResult } from "@/lib/plati/types";
import { mapRowsNodeToItems } from "@/lib/plati/map-to-json";

const PLATI_GOODS_URL = "https://plati.io/xml/goods.asp";

const MAX_ROWS = 500;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type FetchPlatiGoodsParams = {
  guidAgent: string;
  idSection: string;
  lang: string;
  encoding: string;
  page: number;
  rows: number;
  currency: string;
  order: string;
};

export function buildGoodsListRequestXml(p: FetchPlatiGoodsParams): string {
  const rows = Math.min(Math.max(1, Math.floor(p.rows)), MAX_ROWS);
  const page = Math.max(1, Math.floor(p.page));
  return `<?xml version="1.0" encoding="UTF-8"?>
<digiseller.request>
  <guid_agent>${escapeXml(p.guidAgent)}</guid_agent>
  <id_section>${escapeXml(p.idSection)}</id_section>
  <lang>${escapeXml(p.lang)}</lang>
  <encoding>${escapeXml(p.encoding)}</encoding>
  <page>${page}</page>
  <rows>${rows}</rows>
  <currency>${escapeXml(p.currency)}</currency>
  <order>${escapeXml(p.order)}</order>
</digiseller.request>`;
}

function getGuidAgent(): string {
  const g = process.env.PLATI_GUID_AGENT?.trim();
  if (!g) {
    throw new Error("PLATI_GUID_AGENT is not set");
  }
  return g;
}

function responseRoot(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const key = Object.keys(o).find((k) => k.toLowerCase() === "digiseller.response");
  if (!key) return null;
  const inner = o[key];
  if (inner != null && typeof inner === "object" && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return null;
}

function numField(v: unknown): number {
  const n = Number(typeof v === "string" ? v.trim() : v);
  return Number.isFinite(n) ? n : 0;
}

function strField(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/**
 * List goods in a Plati/Digiseller section (affiliate XML API).
 * @see https://plati.market/api/?show=xml&f=2
 */
export async function fetchPlatiGoodsBySection(
  params: Omit<FetchPlatiGoodsParams, "guidAgent"> & { guidAgent?: string },
): Promise<PlatiGoodsListResult> {
  const guidAgent = params.guidAgent?.trim() || getGuidAgent();
  const body = buildGoodsListRequestXml({
    guidAgent,
    idSection: params.idSection,
    lang: params.lang,
    encoding: params.encoding,
    page: params.page,
    rows: params.rows,
    currency: params.currency,
    order: params.order,
  });

  const res = await fetch(PLATI_GOODS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      Accept: "application/xml, text/xml, */*",
    },
    body,
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Plati HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  });
  const parsed = parser.parse(text);
  const root = responseRoot(parsed);
  if (!root) {
    throw new Error("Plati: could not parse digiseller.response");
  }

  const retval = numField(root.retval);
  const retdesc = strField(root.retdesc);
  if (retval !== 0) {
    throw new Error(`Plati retval ${retval}: ${retdesc || "unknown"}`);
  }

  const items = mapRowsNodeToItems(root.rows);

  return {
    retval,
    retdesc,
    idSection: strField(root.id_section || root.id_catalog),
    nameSection: strField(root.name_section || root.name_catalog),
    cntGoods: numField(root.cnt_goods),
    pages: numField(root.pages),
    page: numField(root.page),
    order: strField(root.order),
    items,
  };
}
