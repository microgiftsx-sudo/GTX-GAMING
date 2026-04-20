import { eurToIqd } from '@/lib/currency';
import type { StoreProduct, StoreProductDetail } from '@/lib/store-product';
import { normalizePlatformSlug, deriveCategorySlug } from '@/lib/kinguin/mapProduct';
import type { PlatiSearchItem } from '@/lib/plati/client';
import { extractPlatiPurchaseMeta } from '@/lib/plati/productOptions';

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&w=600&q=60';

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function discountLabel(priceEur: number, originalEur: number | null | undefined): string {
  if (originalEur == null || !Number.isFinite(originalEur) || originalEur <= priceEur) return '—';
  const pct = Math.round((1 - priceEur / originalEur) * 100);
  return pct > 0 ? `-${pct}%` : '—';
}

function normalizeImage(raw: string | undefined | null): string {
  const t = (raw ?? '').trim();
  if (!t) return PLACEHOLDER_IMAGE;
  if (t.startsWith('//')) return `https:${t}`;
  return t;
}

function parseOptionalNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Heuristic category from Plati/Digiseller text (no structured tags like Kinguin). */
function deriveCategoryFromText(title: string, body: string): StoreProduct['category'] {
  const blob = `${title}\n${body}`.toLowerCase();
  const pseudoTags: string[] = [];
  if (/\bwallet\b|\bпополн|\btop-?up\b|\bпин\b|\bpin\b|\bподарочн|\bgift card\b/i.test(blob)) {
    pseudoTags.push('prepaid');
  }
  if (/\bdlc\b|\bдополнен|\bexpansion\b|\bseason pass\b/i.test(blob)) {
    pseudoTags.push('dlc');
  }
  if (/\bwindows\b|\boffice\b|\bантивирус|\bsoftware\b|\bпрограмм/i.test(blob)) {
    pseudoTags.push('software');
  }
  return deriveCategorySlug(pseudoTags);
}

function derivePlatformFromText(title: string, body: string): StoreProduct['platform'] {
  const blob = `${title}\n${body}`;
  return normalizePlatformSlug(blob);
}

export function storeProductFromPlatiSearchItem(item: PlatiSearchItem): StoreProduct {
  const title = (item.name_eng ?? item.name ?? '').trim() || `Product ${item.id}`;
  const body = stripHtml(item.description_eng ?? item.description ?? '');
  const priceEur = Number.isFinite(item.price_eur) ? item.price_eur : 0;
  const origRaw = parseOptionalNumber(item.sale_info?.common_price_eur);
  const originalEur =
    origRaw != null && origRaw > priceEur ? origRaw : null;

  const price = Math.round(eurToIqd(priceEur));
  const original =
    originalEur != null ? Math.round(eurToIqd(originalEur)) : price;

  return {
    id: String(item.id),
    kinguinId: item.id,
    title,
    price,
    originalPrice: original,
    discount: discountLabel(priceEur, originalEur),
    category: deriveCategoryFromText(title, body),
    platform: derivePlatformFromText(title, body),
    region: 'global',
    image: normalizeImage(item.image),
    description: body.length > 0 ? body : null,
  };
}

type PreviewImg = { url?: string; img_real?: string };

function galleryFromDigisellerProduct(p: Record<string, unknown>): string[] {
  const imgs = p.preview_imgs;
  if (!Array.isArray(imgs)) return [];
  const out: string[] = [];
  for (const row of imgs) {
    if (!row || typeof row !== 'object') continue;
    const o = row as PreviewImg;
    const u = o.url ?? o.img_real;
    if (typeof u === 'string' && u.trim()) out.push(u.startsWith('//') ? `https:${u}` : u);
  }
  return out;
}

function youtubeIdsFromDigisellerProduct(p: Record<string, unknown>): string[] {
  const vids = p.preview_videos;
  if (!Array.isArray(vids)) return [];
  const out: string[] = [];
  for (const row of vids) {
    if (!row || typeof row !== 'object') continue;
    const t = (row as { type?: string; video_type?: string; id?: string; video_id?: string })
      .type ?? (row as { video_type?: string }).video_type;
    const id = (row as { id?: string; video_id?: string }).id ?? (row as { video_id?: string }).video_id;
    if (typeof t === 'string' && t.toLowerCase() === 'youtube' && typeof id === 'string' && id.trim()) {
      out.push(id.trim());
    }
  }
  return out;
}

export function storeProductDetailFromDigisellerJson(
  product: Record<string, unknown>,
): StoreProductDetail {
  const id = typeof product.id === 'number' ? product.id : Number(product.id);
  const name = String(product.name ?? '').trim() || `Product ${id}`;
  const infoHtml = String(product.info ?? '');
  const infoText = stripHtml(infoHtml);
  const price = typeof product.price === 'number' ? product.price : Number(product.price);
  const priceEur = Number.isFinite(price) ? price : 0;

  const sale = product.sale_info as Record<string, unknown> | undefined;
  const origEur = parseOptionalNumber(sale?.common_price_eur);
  const originalEur = origEur != null && origEur > priceEur ? origEur : null;

  const priceIqd = Math.round(eurToIqd(priceEur));
  const originalIqd =
    originalEur != null ? Math.round(eurToIqd(originalEur)) : priceIqd;

  const cardUrl = typeof product.card_url === 'string' ? product.card_url.trim() : '';
  const gallery = galleryFromDigisellerProduct(product);
  const rawImg = gallery[0] ?? ((typeof product.image === 'string' ? product.image : '') || cardUrl);
  const mainImage = normalizeImage(rawImg) || PLACEHOLDER_IMAGE;

  const base: StoreProduct = {
    id: String(id),
    kinguinId: Number.isFinite(id) ? id : 0,
    title: name,
    price: priceIqd,
    originalPrice: originalIqd,
    discount: discountLabel(priceEur, originalEur),
    category: deriveCategoryFromText(name, infoText),
    platform: derivePlatformFromText(name, infoText),
    region: 'global',
    image: mainImage,
    description: infoText.length > 0 ? infoText : null,
  };

  const galleryUrls = galleryFromDigisellerProduct(product);
  const youtubeIds = youtubeIdsFromDigisellerProduct(product);

  const platiMeta = extractPlatiPurchaseMeta(product);

  return {
    ...base,
    galleryUrls: galleryUrls.length > 0 ? galleryUrls : [base.image],
    youtubeIds,
    catalogSource: 'plati',
    platiOptionGroups: platiMeta.groups.length > 0 ? platiMeta.groups : undefined,
    platiSelections: platiMeta.allSelections.length > 0 ? platiMeta.allSelections : undefined,
    platiCollection: platiMeta.collection || undefined,
  };
}
