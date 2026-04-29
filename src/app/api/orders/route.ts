import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import '@/lib/load-env';
import { auth } from '@/auth';
import { getReceiptsDir } from '@/lib/data-root';
import { createOrder, listPaymentMethods, OrderItem } from '@/lib/orders';
import {
  discountIqdFromPercent,
  incrementCouponUse,
  normalizeCouponCode,
  validateCouponCode,
} from '@/lib/coupons';
import { getTaxRatePercent, netFromGrossIqd } from '@/lib/tax';
import { sendOrderToTelegram } from '@/lib/telegram-bot';
import { getCatalogProvider } from '@/lib/catalog-provider';
import { storefrontProductUrl } from '@/lib/catalog/facade';
import { sendOrderCreatedEmail } from '@/lib/order-mail';

export const dynamic = 'force-dynamic';

type OrderItemInput = {
  id: string;
  title: string;
  price: number;
  quantity: number;
  image?: string;
};

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const form = await req.formData();
    const formEmail = normalizeEmail(String(form.get('email') ?? ''));
    const sessionEmail = normalizeEmail(String(session?.user?.email ?? ''));
    const email = formEmail || sessionEmail;
    const locale = String(form.get('locale') ?? 'ar').trim();
    const paymentMethodId = String(form.get('paymentMethodId') ?? '').trim();
    const rawItems = String(form.get('items') ?? '[]');
    const rawSubtotal = Number(form.get('subtotal') ?? 0);
    const couponCodeRaw = normalizeCouponCode(String(form.get('couponCode') ?? ''));
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

    const ordersDir = getReceiptsDir();
    await mkdir(ordersDir, { recursive: true });
    const safeName = sanitizeFileName(receipt.name || 'proof.png');
    const receiptFile = `${Date.now()}-${safeName}`;
    const receiptPath = path.join(ordersDir, receiptFile);
    const bytes = await receipt.arrayBuffer();
    await writeFile(receiptPath, Buffer.from(bytes));

    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') ?? 'https';
    const baseUrl = host ? `${proto}://${host}` : '';
    const receiptUrl = `${baseUrl}/api/uploads/receipt/${receiptFile}`;

    const catalogProvider = await getCatalogProvider();
    const items: OrderItem[] = parsedItems.map((item) => ({
      id: String(item.id),
      title: String(item.title),
      price: Number(item.price) || 0,
      quantity: Math.max(1, Number(item.quantity) || 1),
      image: item.image ? String(item.image) : undefined,
      kinguinUrl: storefrontProductUrl(catalogProvider, String(item.id)),
    }));

    const sumFromItems = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const baseTotal =
      sumFromItems > 0
        ? sumFromItems
        : rawSubtotal > 0
          ? rawSubtotal
          : 0;

    const taxRate = await getTaxRatePercent();
    /** Cart line prices are VAT-inclusive (same as storefront API). */
    const grossTotal = Math.round(baseTotal);
    let subtotalBeforeTax: number;
    let totalAfterTax: number;
    let taxAmount: number;
    if (taxRate <= 0) {
      subtotalBeforeTax = grossTotal;
      totalAfterTax = grossTotal;
      taxAmount = 0;
    } else {
      totalAfterTax = grossTotal;
      subtotalBeforeTax = netFromGrossIqd(grossTotal, taxRate);
      taxAmount = grossTotal - subtotalBeforeTax;
    }

    let finalTotal = totalAfterTax;
    let discountAmount = 0;
    let couponPercentOff: number | undefined;
    let appliedCouponCode: string | undefined;

    if (couponCodeRaw.length > 0) {
      const v = await validateCouponCode(couponCodeRaw);
      if (!v.ok) {
        return NextResponse.json({ error: 'Invalid or expired coupon', reason: v.reason }, { status: 400 });
      }
      couponPercentOff = v.percentOff;
      appliedCouponCode = couponCodeRaw.trim().toUpperCase().replace(/\s+/g, '');
      discountAmount = discountIqdFromPercent(totalAfterTax, v.percentOff);
      finalTotal = Math.max(0, totalAfterTax - discountAmount);
    }

    const order = await createOrder({
      email,
      locale,
      paymentMethodId: selectedMethod.id,
      paymentMethodName: selectedMethod.name,
      subtotal: finalTotal,
      receiptUrl,
      items,
      subtotalBeforeTax,
      taxRatePercent: taxRate,
      taxAmount,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      couponCode: appliedCouponCode,
      couponPercentOff,
    });

    if (appliedCouponCode) {
      await incrementCouponUse(appliedCouponCode);
    }

    try {
      await sendOrderToTelegram(order);
    } catch (error) {
      console.error('Failed sending order to Telegram:', error);
    }
    try {
      await sendOrderCreatedEmail(order);
    } catch (error) {
      console.error('Failed sending order-created email:', error);
    }

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

