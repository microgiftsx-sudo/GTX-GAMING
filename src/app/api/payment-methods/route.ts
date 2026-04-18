import { NextResponse } from 'next/server';
import '@/lib/load-env';
import { listPaymentMethods } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export async function GET() {
  const methods = await listPaymentMethods();
  return NextResponse.json({
    methods: methods.filter((m) => m.enabled),
  });
}

