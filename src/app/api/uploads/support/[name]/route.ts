import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import '@/lib/load-env';
import { getSupportUploadsDir } from '@/lib/data-root';

export const dynamic = 'force-dynamic';

function contentTypeForName(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mov') return 'video/quicktime';
  return 'application/octet-stream';
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params;
  const base = path.basename(name);
  if (!base || base !== name || !/^[a-zA-Z0-9._-]+$/.test(base)) {
    return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
  }
  const filePath = path.join(getSupportUploadsDir(), base);
  const resolved = path.resolve(filePath);
  const root = path.resolve(getSupportUploadsDir());
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }
  try {
    const buf = await readFile(resolved);
    return new NextResponse(buf, {
      headers: {
        'content-type': contentTypeForName(base),
        'cache-control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

