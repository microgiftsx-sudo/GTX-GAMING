import type { OrderRecord } from '@/lib/orders';

const RESEND_API_URL = 'https://api.resend.com/emails';

function appBaseUrl(): string {
  return (
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    'http://localhost:3000'
  );
}

export function orderPublicUrl(order: OrderRecord): string {
  const base = appBaseUrl().replace(/\/+$/, '');
  const locale = order.locale === 'en' ? 'en' : 'ar';
  return `${base}/${locale}/orders/${encodeURIComponent(order.id)}?token=${encodeURIComponent(order.viewerToken)}`;
}

export async function sendOrderDeliveredEmail(
  order: OrderRecord,
  deliveryDetails: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.ORDER_EMAIL_FROM?.trim();
  if (!apiKey || !from) return;

  const orderUrl = orderPublicUrl(order);
  const subject =
    order.locale === 'en'
      ? `Your order ${order.id} has been delivered`
      : `تم تسليم طلبك ${order.id}`;

  const text =
    order.locale === 'en'
      ? [
          `Hello,`,
          ``,
          `Your order ${order.id} is now delivered.`,
          `Delivery details: ${deliveryDetails}`,
          ``,
          `View order status: ${orderUrl}`,
          ``,
          `Thank you for shopping with us.`,
        ].join('\n')
      : [
          `مرحباً،`,
          ``,
          `تم تسليم طلبك رقم ${order.id}.`,
          `تفاصيل التسليم: ${deliveryDetails}`,
          ``,
          `رابط متابعة الطلب: ${orderUrl}`,
          ``,
          `شكراً لثقتك بنا.`,
        ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.7;color:#111">
      <p>${order.locale === 'en' ? 'Hello,' : 'مرحباً،'}</p>
      <p>${
        order.locale === 'en'
          ? `Your order <strong>${order.id}</strong> is now delivered.`
          : `تم تسليم طلبك رقم <strong>${order.id}</strong>.`
      }</p>
      <p><strong>${order.locale === 'en' ? 'Delivery details' : 'تفاصيل التسليم'}:</strong><br/>${deliveryDetails.replace(/\n/g, '<br/>')}</p>
      <p>
        <a href="${orderUrl}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#ff6b00;color:#fff;text-decoration:none">
          ${order.locale === 'en' ? 'View order status' : 'عرض حالة الطلب'}
        </a>
      </p>
    </div>
  `;

  await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [order.email],
      subject,
      text,
      html,
    }),
  });
}

