import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getDataRoot } from '@/lib/data-root';

export type PaymentMethod = {
  id: string;
  name: string;
  icon: string;
  account: string;
  enabled: boolean;
  /** HTTPS URL to QR/barcode image on checkout (optional) */
  barcodeUrl?: string;
};

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'on_hold'
  | 'refunded'
  | 'cancelled';

export type OrderItem = {
  id: string;
  title: string;
  price: number;
  quantity: number;
  image?: string;
  kinguinUrl: string;
};

export type OrderRecord = {
  id: string;
  /** Public viewer token (emailed to buyer) for order-status page access. */
  viewerToken: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  email: string;
  locale: string;
  paymentMethodId: string;
  paymentMethodName: string;
  /** Total IQD due (including tax when tax is enabled) */
  subtotal: number;
  receiptUrl: string;
  items: OrderItem[];
  notes?: string;
  /** Admin-entered delivery details (sent by email + shown on order page). */
  deliveryDetails?: string;
  deliveredAt?: string;
  deliveryNotifiedAt?: string;
  /** IQD sum of line items before tax */
  subtotalBeforeTax?: number;
  taxRatePercent?: number;
  taxAmount?: number;
  /** IQD discount off total after tax */
  discountAmount?: number;
  couponCode?: string;
  couponPercentOff?: number;
};

const DATA_DIR = getDataRoot();
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const METHODS_FILE = path.join(DATA_DIR, 'payment-methods.json');

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'fib', name: 'First Bank (FIB)', icon: '/icons/firstbank.png', account: '8000 9999 1111', enabled: true },
  { id: 'zain', name: 'Zain Cash', icon: '/icons/zaincash.png', account: '0780 123 4567', enabled: true },
  { id: 'qi', name: 'Super Qi', icon: '/icons/superqi.png', account: '7000 1234 5678', enabled: true },
  { id: 'fastpay', name: 'FastPay', icon: '/icons/fastpay.png', account: '4000 4444 5555', enabled: true },
];

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readJsonOrDefault<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, value: unknown) {
  await ensureDataDir();
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function listOrders(): Promise<OrderRecord[]> {
  return readJsonOrDefault<OrderRecord[]>(ORDERS_FILE, []);
}

export async function saveOrders(orders: OrderRecord[]) {
  await writeJson(ORDERS_FILE, orders);
}

export async function getOrder(orderId: string): Promise<OrderRecord | null> {
  const orders = await listOrders();
  return orders.find((order) => order.id === orderId) ?? null;
}

function createOrderId() {
  const ts = new Date();
  const y = ts.getUTCFullYear();
  const m = String(ts.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ts.getUTCDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `GTX-${y}${m}${d}-${suffix}`;
}

function createViewerToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.toUpperCase();
}

export async function createOrder(
  input: Omit<OrderRecord, 'id' | 'viewerToken' | 'createdAt' | 'updatedAt' | 'status'>,
): Promise<OrderRecord> {
  const now = new Date().toISOString();
  const order: OrderRecord = {
    ...input,
    id: createOrderId(),
    viewerToken: createViewerToken(),
    createdAt: now,
    updatedAt: now,
    status: 'pending',
  };
  const orders = await listOrders();
  orders.unshift(order);
  await saveOrders(orders);
  return order;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<OrderRecord | null> {
  const orders = await listOrders();
  const idx = orders.findIndex((order) => order.id === orderId);
  if (idx === -1) return null;
  const current = orders[idx];
  const next: OrderRecord = {
    ...current,
    status,
    updatedAt: new Date().toISOString(),
  };
  orders[idx] = next;
  await saveOrders(orders);
  return next;
}

export async function markOrderDelivered(
  orderId: string,
  deliveryDetails: string,
): Promise<OrderRecord | null> {
  const orders = await listOrders();
  const idx = orders.findIndex((order) => order.id === orderId);
  if (idx === -1) return null;
  const current = orders[idx];
  const now = new Date().toISOString();
  const next: OrderRecord = {
    ...current,
    status: 'completed',
    deliveryDetails: deliveryDetails.trim(),
    deliveredAt: now,
    updatedAt: now,
  };
  orders[idx] = next;
  await saveOrders(orders);
  return next;
}

export async function markOrderDeliveryNotified(orderId: string): Promise<OrderRecord | null> {
  const orders = await listOrders();
  const idx = orders.findIndex((order) => order.id === orderId);
  if (idx === -1) return null;
  const current = orders[idx];
  const now = new Date().toISOString();
  const next: OrderRecord = {
    ...current,
    deliveryNotifiedAt: now,
    updatedAt: now,
  };
  orders[idx] = next;
  await saveOrders(orders);
  return next;
}

function mergeMethodWithDefaults(method: PaymentMethod): PaymentMethod {
  const d = DEFAULT_PAYMENT_METHODS.find((m) => m.id === method.id);
  if (!d) return method;
  return {
    ...d,
    ...method,
    name: method.name ?? d.name,
    icon: method.icon ?? d.icon,
    account: method.account ?? d.account,
    enabled: typeof method.enabled === 'boolean' ? method.enabled : d.enabled,
  };
}

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const methods = await readJsonOrDefault<PaymentMethod[]>(METHODS_FILE, DEFAULT_PAYMENT_METHODS);
  if (!Array.isArray(methods) || methods.length === 0) {
    return DEFAULT_PAYMENT_METHODS.map((m) => ({ ...m }));
  }
  return methods.map(mergeMethodWithDefaults);
}

export async function savePaymentMethods(methods: PaymentMethod[]) {
  await writeJson(METHODS_FILE, methods);
}

export async function updatePaymentMethod(
  methodId: string,
  patch: Partial<Pick<PaymentMethod, 'name' | 'icon' | 'account' | 'barcodeUrl' | 'enabled'>>,
): Promise<PaymentMethod | null> {
  const methods = await listPaymentMethods();
  const idx = methods.findIndex((m) => m.id === methodId);
  if (idx === -1) return null;
  const next = { ...methods[idx], ...patch };
  methods[idx] = mergeMethodWithDefaults(next);
  await savePaymentMethods(methods);
  return methods[idx];
}

