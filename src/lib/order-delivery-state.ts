import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getDataRoot } from '@/lib/data-root';

export type PendingOrderDelivery = {
  orderId: string;
  itemIndex: number;
  productDetails: string[];
  expiresAt: number;
};

const FILE = path.join(getDataRoot(), 'telegram-order-delivery.json');
const TTL_MS = 20 * 60 * 1000;

type Store = Record<string, PendingOrderDelivery>;

async function readStore(): Promise<Store> {
  try {
    const raw = await readFile(FILE, 'utf8');
    const data = JSON.parse(raw) as Store;
    return typeof data === 'object' && data !== null ? data : {};
  } catch {
    return {};
  }
}

async function writeStore(store: Store) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

export async function setPendingOrderDelivery(
  userId: number,
  orderId: string,
  itemIndex = 0,
  productDetails: string[] = [],
): Promise<void> {
  const store = await readStore();
  store[String(userId)] = {
    orderId,
    itemIndex,
    productDetails,
    expiresAt: Date.now() + TTL_MS,
  };
  await writeStore(store);
}

export async function getPendingOrderDelivery(userId: number): Promise<PendingOrderDelivery | null> {
  const store = await readStore();
  const pending = store[String(userId)];
  if (!pending) return null;
  if (pending.expiresAt < Date.now()) {
    delete store[String(userId)];
    await writeStore(store);
    return null;
  }
  return pending;
}

export async function clearPendingOrderDelivery(userId: number): Promise<void> {
  const store = await readStore();
  delete store[String(userId)];
  await writeStore(store);
}

