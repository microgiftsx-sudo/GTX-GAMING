import { NextResponse } from 'next/server';
import '@/lib/load-env';
import { getHeroStoreProducts } from '@/lib/hero-products';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await getHeroStoreProducts();
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
