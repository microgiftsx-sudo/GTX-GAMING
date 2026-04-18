import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import '@/lib/load-env';
import { createOrder, listPaymentMethods, OrderItem } from '@/lib/orders';
import { sendOrderToTelegram } from '@/lib/telegram-bot';

export const dynamic = 'force-dynamic';

type OrderItemInput = {
  id: string;
  title: string;
  price: number;
  quantity: number;
  image?: string;
};

function kinguinProductUrl(productId: string) {
  return `https://www.kinguin.net/product/${encodeURIComponent(productId)}`;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const email = String(form.get('email') ?? '').trim();
    const locale = String(form.get('locale') ?? 'ar').trim();
    const paymentMethodId = String(form.get('paymentMethodId') ?? '').trim();
    const rawItems = String(form.get('items') ?? '[]');
    const rawSubtotal = Number(form.get('subtotal') ?? 0);
    const receipt = form.get('receipt');

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 });
    }
    if (!(receipt instanceof File) || receipt.size === 0) {
      return NextResponse.json({ error: 'Receipt image is required' }, { status: 400 });
    }

    const methods = await listPaymentMethods();
    const selectedMethod = methods.find((method) => method.id === paymentMethodId && method.enabled);
    if (!selectedMethod) {
      return NextResponse.json({ error: 'Payment method unavailable' }, { status: 400 });
    }

    const parsedItems = JSON.parse(rawItems) as OrderItemInput[];
    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return NextResponse.json({ error: 'Order items are required' }, { status: 400 });
    }

    const ordersDir = path.join(process.cwd(), 'public', 'uploads', 'receipts');
    await mkdir(ordersDir, { recursive: true });
    const safeName = sanitizeFileName(receipt.name || 'proof.png');
    const receiptFile = `${Date.now()}-${safeName}`;
    const receiptPath = path.join(ordersDir, receiptFile);
    const bytes = await receipt.arrayBuffer();
    await writeFile(receiptPath, Buffer.from(bytes));

    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') ?? 'https';
    const baseUrl = host ? `${proto}://${host}` : '';
    const receiptUrl = `${baseUrl}/uploads/receipts/${receiptFile}`;

    const items: OrderItem[] = parsedItems.map((item) => ({
      id: String(item.id),
      title: String(item.title),
      price: Number(item.price) || 0,
      quantity: Math.max(1, Number(item.quantity) || 1),
      image: item.image ? String(item.image) : undefined,
      kinguinUrl: kinguinProductUrl(String(item.id)),
    }));

    const subtotal =
      rawSubtotal > 0
        ? rawSubtotal
        : items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order = await createOrder({
      email,
      locale,
      paymentMethodId: selectedMethod.id,
      paymentMethodName: selectedMethod.name,
      subtotal,
      receiptUrl,
      items,
    });

    try {
      await sendOrderToTelegram(order);
    } catch (error) {
      console.error('Failed sending order to Telegram:', error);
    }

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

