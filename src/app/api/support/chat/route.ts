import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import '@/lib/load-env';
import { getSupportUploadsDir } from '@/lib/data-root';
import {
  addSupportCustomerMessage,
  createSupportTicket,
  getSupportTicket,
  type SupportAttachment,
} from '@/lib/support-tickets';
import { sendSupportTicketMessageToTelegram } from '@/lib/telegram-bot';

export const dynamic = 'force-dynamic';

function asText(v: unknown, maxLen: number): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, maxLen);
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function mediaKindFromType(contentType: string): SupportAttachment['kind'] | null {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  return null;
}

export async function GET(req: NextRequest) {
  const ticketId = asText(req.nextUrl.searchParams.get('ticketId'), 64);
  if (!ticketId) {
    return NextResponse.json({ error: 'ticketId is required' }, { status: 400 });
  }
  const ticket = await getSupportTicket(ticketId);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ticket });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const ticketIdInput = asText(form.get('ticketId'), 64);
    const locale = asText(form.get('locale'), 12);
    const pageUrl = asText(form.get('pageUrl'), 500);
    const message = asText(form.get('message'), 1800);
    const media = form.get('media');

    let ticket = ticketIdInput ? await getSupportTicket(ticketIdInput) : null;
    if (!ticket) {
      ticket = await createSupportTicket(locale || undefined);
    }

    let attachment: SupportAttachment | undefined;
    let mediaUpload:
      | {
          kind: SupportAttachment['kind'];
          bytes: Uint8Array;
          fileName: string;
          contentType: string;
        }
      | undefined;
    if (media instanceof File && media.size > 0) {
      if (media.size > 20 * 1024 * 1024) {
        return NextResponse.json({ error: 'Media too large (max 20MB)' }, { status: 400 });
      }
      const kind = mediaKindFromType(media.type);
      if (!kind) {
        return NextResponse.json({ error: 'Only image/video are allowed' }, { status: 400 });
      }
      const uploadsDir = getSupportUploadsDir();
      await mkdir(uploadsDir, { recursive: true });
      const safeName = sanitizeFileName(media.name || (kind === 'image' ? 'image' : 'video'));
      const storedName = `${Date.now()}-${safeName}`;
      const fullPath = path.join(uploadsDir, storedName);
      const bytes = Buffer.from(await media.arrayBuffer());
      await writeFile(fullPath, bytes);
      const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
      const proto = req.headers.get('x-forwarded-proto') ?? 'https';
      const baseUrl = host ? `${proto}://${host}` : '';
      const mediaUrl = `${baseUrl}/api/uploads/support/${storedName}`;
      attachment = { kind, url: mediaUrl, fileName: media.name || safeName };
      mediaUpload = {
        kind,
        bytes,
        fileName: media.name || safeName,
        contentType: media.type || 'application/octet-stream',
      };
    }

    if (!message && !attachment) {
      return NextResponse.json({ error: 'Message or media is required' }, { status: 400 });
    }

    const updated = await addSupportCustomerMessage(ticket.id, {
      message,
      attachment,
    });
    if (!updated) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    try {
      await sendSupportTicketMessageToTelegram({
        ticketId: ticket.id,
        message,
        attachment,
      mediaUpload,
        locale: locale || undefined,
        pageUrl: pageUrl || undefined,
      });
    } catch (err) {
      console.error('Support chat Telegram forward failed:', err);
    }

    return NextResponse.json({ ok: true, ticket: updated, ticketId: ticket.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

