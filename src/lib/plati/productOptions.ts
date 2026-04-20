import type { ProductOptionGroup } from '@/lib/store-product';

type DigisellerVariant = {
  value?: number;
  text?: string;
  default?: number;
  visible?: number;
};

type DigisellerOptionRow = {
  id?: number;
  name?: string;
  label?: string;
  type?: string;
  required?: number;
  variants?: DigisellerVariant[];
};

function stripHtml(raw: string): string {
  return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function pickDefaultValueId(opt: DigisellerOptionRow): number | null {
  const vars = opt.variants ?? [];
  const visibleVars = vars.filter((v) => v.visible !== 0);
  const use = visibleVars.length > 0 ? visibleVars : vars;
  const def = use.find((v) => v.default === 1);
  const pick = def ?? use[0];
  const v = pick?.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Build UI groups + full default selection map for Digiseller price/calc. */
export function extractPlatiPurchaseMeta(product: Record<string, unknown>): {
  groups: ProductOptionGroup[];
  allSelections: { optionId: number; valueId: number }[];
  collection: string;
} {
  const rawOpts = product.options;
  const collection = typeof product.collection === 'string' ? product.collection : '';
  const groups: ProductOptionGroup[] = [];
  const allSelections: { optionId: number; valueId: number }[] = [];

  if (!Array.isArray(rawOpts)) {
    return { groups, allSelections, collection };
  }

  for (const row of rawOpts) {
    if (!row || typeof row !== 'object') continue;
    const opt = row as DigisellerOptionRow;
    const optionId = opt.id;
    if (typeof optionId !== 'number' || !Number.isFinite(optionId)) continue;

    const defVid = pickDefaultValueId(opt);
    if (defVid != null) {
      allSelections.push({ optionId, valueId: defVid });
    }
  }

  for (const row of rawOpts) {
    if (!row || typeof row !== 'object') continue;
    const opt = row as DigisellerOptionRow;
    const optionId = opt.id;
    if (typeof optionId !== 'number' || !Number.isFinite(optionId)) continue;

    const type = String(opt.type ?? '').toLowerCase();
    if (type !== 'radio' && type !== 'select') continue;

    const vars = opt.variants ?? [];
    const visibleVars = vars.filter((v) => v.visible !== 0);
    const use = visibleVars.length > 0 ? visibleVars : vars;

    const choices = use
      .map((v) => {
        const valueId = v.value;
        if (typeof valueId !== 'number' || !Number.isFinite(valueId)) return null;
        const label = stripHtml(String(v.text ?? '')).trim() || `Option ${valueId}`;
        return { valueId, label };
      })
      .filter((x): x is { valueId: number; label: string } => x != null);

    if (choices.length < 2) continue;

    groups.push({
      optionId,
      label: stripHtml(String(opt.label ?? opt.name ?? 'Option')).trim() || 'Option',
      type: type === 'select' ? 'select' : 'radio',
      required: opt.required === 1,
      choices,
    });
  }

  return { groups, allSelections, collection };
}

/** Merge user picks into full selection list for every option row on the product. */
export function mergePlatiSelectionsForCalc(
  product: Record<string, unknown>,
  overrides: { optionId: number; valueId: number }[],
): { optionId: number; valueId: number }[] {
  const overrideMap = new Map(overrides.map((o) => [o.optionId, o.valueId]));
  const rawOpts = product.options;
  if (!Array.isArray(rawOpts)) return [...overrides];

  const out: { optionId: number; valueId: number }[] = [];

  for (const row of rawOpts) {
    if (!row || typeof row !== 'object') continue;
    const opt = row as DigisellerOptionRow;
    const optionId = opt.id;
    if (typeof optionId !== 'number' || !Number.isFinite(optionId)) continue;

    const ov = overrideMap.get(optionId);
    if (ov != null) {
      out.push({ optionId, valueId: ov });
      continue;
    }

    const defVid = pickDefaultValueId(opt);
    if (defVid != null) out.push({ optionId, valueId: defVid });
  }

  return out;
}
