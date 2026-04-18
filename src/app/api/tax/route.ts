import { NextResponse } from 'next/server';
import '@/lib/load-env';
import { getTaxRatePercent } from '@/lib/tax';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ratePercent = await getTaxRatePercent();
  return NextResponse.json({ ratePercent });
}
