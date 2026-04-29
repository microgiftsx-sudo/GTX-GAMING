import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getDataRoot } from '@/lib/data-root';

export type SupportAttachment = {
  url: string;
  kind: 'image' | 'video';
  fileName: string;
};

export type SupportMessage = {
  id: string;
  from: 'customer' | 'agent';
  text?: string;
  attachment?: SupportAttachment;
  createdAt: string;
};

export type SupportTicket = {
  id: string;
  locale?: string;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
};

const DATA_FILE = path.join(getDataRoot(), 'support-tickets.json');

async function ensureDataDir() {
  await mkdir(getDataRoot(), { recursive: true });
}

async function listTickets(): Promise<SupportTicket[]> {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as SupportTicket[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveTickets(tickets: SupportTicket[]) {
  await ensureDataDir();
  await writeFile(DATA_FILE, `${JSON.stringify(tickets, null, 2)}\n`, 'utf8');
}

function nextTicketId() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `TKT-${y}${m}${d}-${rand}`;
}

function nextMessageId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function getSupportTicket(ticketId: string): Promise<SupportTicket | null> {
  const tickets = await listTickets();
  return tickets.find((t) => t.id === ticketId) ?? null;
}

export async function createSupportTicket(locale?: string): Promise<SupportTicket> {
  const now = new Date().toISOString();
  const ticket: SupportTicket = {
    id: nextTicketId(),
    locale: locale?.trim() || undefined,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  const tickets = await listTickets();
  tickets.unshift(ticket);
  await saveTickets(tickets);
  return ticket;
}

export async function addSupportCustomerMessage(
  ticketId: string,
  input: { text?: string; attachment?: SupportAttachment },
): Promise<SupportTicket | null> {
  const tickets = await listTickets();
  const idx = tickets.findIndex((t) => t.id === ticketId);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  const msg: SupportMessage = {
    id: nextMessageId(),
    from: 'customer',
    createdAt: now,
    ...(input.text?.trim() ? { text: input.text.trim() } : {}),
    ...(input.attachment ? { attachment: input.attachment } : {}),
  };
  const next: SupportTicket = {
    ...tickets[idx],
    updatedAt: now,
    messages: [...tickets[idx].messages, msg],
  };
  tickets[idx] = next;
  await saveTickets(tickets);
  return next;
}

export async function addSupportAgentReply(
  ticketId: string,
  text: string,
): Promise<SupportTicket | null> {
  const body = text.trim();
  if (!body) return null;
  const tickets = await listTickets();
  const idx = tickets.findIndex((t) => t.id === ticketId);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  const msg: SupportMessage = {
    id: nextMessageId(),
    from: 'agent',
    text: body,
    createdAt: now,
  };
  const next: SupportTicket = {
    ...tickets[idx],
    updatedAt: now,
    messages: [...tickets[idx].messages, msg],
  };
  tickets[idx] = next;
  await saveTickets(tickets);
  return next;
}

