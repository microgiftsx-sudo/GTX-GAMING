import { NextRequest, NextResponse } from 'next/server';
import '@/lib/load-env';
import { validateCouponCode } from '@/lib/coupons';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') ?? '';
  const v = await validateCouponCode(code);
  if (!v.ok) {
    return NextResponse.json({ valid: false as const, reason: v.reason });
  }
  return NextResponse.json({ valid: true as const, percentOff: v.percentOff });
}
