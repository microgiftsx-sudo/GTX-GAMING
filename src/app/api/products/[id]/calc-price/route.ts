import { NextRequest, NextResponse } from 'next/server';
import '@/lib/load-env';
import { getCatalogProvider } from '@/lib/catalog-provider';
import { fetchDigisellerProductData } from '@/lib/plati/client';
import { mergePlatiSelectionsForCalc } from '@/lib/plati/productOptions';
import { digisellerCalcPriceEur } from '@/lib/plati/priceCalc';
import { getTaxRatePercent } from '@/lib/tax';
import { eurToIqd } from '@/lib/currency';
import { applyTaxToBaseIqd } from '@/lib/tax-math';

export const dynamic = 'force-dynamic';

type SelectionBody = { optionId: number; valueId: number };

function saneEur(calcEur: number, dataEur: number, collection: string): number {
  if (!Number.isFinite(dataEur) || dataEur <= 0) return calcEur;
  if (collection === 'unit') return dataEur;
  if (calcEur <= 0) return dataEur;
  if (calcEur < dataEur * 0.15 || calcEur > dataEur * 25 + 100) return dataEur;
  return calcEur;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const provider = await getCatalogProvider();
    if (provider !== 'plati') {
      return NextResponse.json(
        { error: 'Price options are only available for the Plati catalog.' },
        { status: 400 },
      );
    }

    const { id } = await context.params;
    const kid = Number.parseInt(id, 10);
    if (!Number.isFinite(kid)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = (await req.json()) as { selections?: SelectionBody[] };
    const selections = Array.isArray(body.selections) ? body.selections : [];

    const data = await fetchDigisellerProductData(kid);
    if (data.retval !== 0 || !data.product || typeof data.product !== 'object') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const product = data.product as Record<string, unknown>;
    const merged = mergePlatiSelectionsForCalc(product, selections);
    const dataEur =
      typeof product.price === 'number' && Number.isFinite(product.price) ? product.price : 0;
    const collection = String(product.collection ?? '');

    const calc = await digisellerCalcPriceEur({
      productId: kid,
      selections: merged,
      count: 1,
    });

    let eur = dataEur;
    if (calc.ok) {
      eur = saneEur(calc.eur, dataEur, collection);
    }

    const taxRate = await getTaxRatePercent();
    const baseIqd = Math.round(eurToIqd(eur));
    const grossIqd = applyTaxToBaseIqd(baseIqd, taxRate);

    return NextResponse.json({
      price: grossIqd,
      priceEur: eur,
      selections: merged,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
