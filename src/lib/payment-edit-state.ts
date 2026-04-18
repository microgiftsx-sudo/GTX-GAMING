import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type PaymentEditField = 'name' | 'account' | 'barcodeUrl' | 'icon';

export type PendingPaymentEdit = {
  methodId: string;
  field: PaymentEditField;
  expiresAt: number;
};

const FILE = path.join(process.cwd(), 'data', 'telegram-payment-edit.json');
const TTL_MS = 15 * 60 * 1000;

type Store = Record<string, PendingPaymentEdit>;

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

export async function setPendingPaymentEdit(userId: number, methodId: string, field: PaymentEditField): Promise<void> {
  const store = await readStore();
  const key = String(userId);
  store[key] = {
    methodId,
    field,
    expiresAt: Date.now() + TTL_MS,
  };
  await writeStore(store);
}

export async function getPendingPaymentEdit(userId: number): Promise<PendingPaymentEdit | null> {
  const store = await readStore();
  const key = String(userId);
  const pending = store[key];
  if (!pending) return null;
  if (pending.expiresAt < Date.now()) {
    delete store[key];
    await writeStore(store);
    return null;
  }
  return pending;
}

export async function clearPendingPaymentEdit(userId: number): Promise<void> {
  const store = await readStore();
  delete store[String(userId)];
  await writeStore(store);
}
