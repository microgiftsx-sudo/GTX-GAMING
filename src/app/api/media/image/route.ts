import { NextRequest, NextResponse } from 'next/server';
import '@/lib/load-env';
import { isAllowedImageHost, normalizeImageUrl } from '@/lib/storefront-image';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 6 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');
  if (!raw?.trim()) {
    return NextResponse.json({ error: 'missing url' }, { status: 400 });
  }

  const normalized = normalizeImageUrl(raw);
  let target: URL;
  try {
    target = new URL(normalized);
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 });
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return NextResponse.json({ error: 'invalid protocol' }, { status: 400 });
  }

  if (!isAllowedImageHost(target.hostname)) {
    return NextResponse.json({ error: 'forbidden host' }, { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; GTX-Store/1.0)',
      },
      redirect: 'follow',
      next: { revalidate: 86400 },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'upstream', status: upstream.status },
        { status: 502 },
      );
    }

    const len = upstream.headers.get('content-length');
    if (len && Number(len) > MAX_BYTES) {
      return NextResponse.json({ error: 'too large' }, { status: 413 });
    }

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'too large' }, { status: 413 });
    }

    const ct =
      upstream.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
    if (!ct.startsWith('image/')) {
      return NextResponse.json({ error: 'not an image' }, { status: 502 });
    }

    return new NextResponse(buf, {
      headers: {
        'content-type': ct,
        'cache-control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
