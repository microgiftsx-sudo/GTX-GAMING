import { NextRequest, NextResponse } from 'next/server';
import '@/lib/load-env';
import { handleTelegramUpdate } from '@/lib/telegram-bot';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    await handleTelegramUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

