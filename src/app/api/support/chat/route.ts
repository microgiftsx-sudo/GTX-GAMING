import { NextRequest, NextResponse } from 'next/server';
import '@/lib/load-env';
import { sendCustomerSupportMessageToTelegram } from '@/lib/telegram-bot';

function asText(v: unknown, maxLen: number): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, maxLen);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name?: unknown;
      contact?: unknown;
      message?: unknown;
      locale?: unknown;
      pageUrl?: unknown;
    };

    const name = asText(body?.name, 80);
    const contact = asText(body?.contact, 120);
    const message = asText(body?.message, 1800);
    const locale = asText(body?.locale, 12);
    const pageUrl = asText(body?.pageUrl, 500);

    if (name.length < 2 || contact.length < 3 || message.length < 3) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    await sendCustomerSupportMessageToTelegram({
      name,
      contact,
      message,
      locale: locale || undefined,
      pageUrl: pageUrl || undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

