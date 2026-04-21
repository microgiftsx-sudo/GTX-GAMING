import { NextRequest, NextResponse } from 'next/server';

/**
 * Verifies a Cloudflare Turnstile token (server-side).
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const token =
    typeof body === 'object' &&
    body !== null &&
    'token' in body &&
    typeof (body as { token: unknown }).token === 'string'
      ? (body as { token: string }).token.trim()
      : '';

  if (!token) {
    return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });
  }

  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return NextResponse.json({ ok: true, skipped: true as const });
  }

  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  const forwarded = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for');
  if (forwarded) {
    form.set('remoteip', forwarded.split(',')[0].trim());
  }

  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
    cache: 'no-store',
  });

  const data = (await r.json()) as { success?: boolean; 'error-codes'?: string[] };
  if (data.success === true) {
    return NextResponse.json({ ok: true as const });
  }
  return NextResponse.json(
    { ok: false as const, error: 'verification_failed', codes: data['error-codes'] ?? [] },
    { status: 400 },
  );
}
