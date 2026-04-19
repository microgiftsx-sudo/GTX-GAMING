import { NextResponse } from 'next/server';
import '@/lib/load-env';
import { getCachedHeroHomeItems } from '@/lib/home-feed';

export async function GET() {
  try {
    const items = await getCachedHeroHomeItems();
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
