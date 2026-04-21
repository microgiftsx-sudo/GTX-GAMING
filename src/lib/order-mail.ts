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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function iqd(n: number): string {
  return `${Math.round(n).toLocaleString('en-US')} IQD`;
}

export async function sendOrderDeliveredEmail(
  order: OrderRecord,
  deliveryDetails: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.ORDER_EMAIL_FROM?.trim();
  if (!apiKey || !from) return;

  const orderUrl = orderPublicUrl(order);
  const isAr = order.locale !== 'en';
  const subject =
    !isAr
      ? `Your order ${order.id} has been delivered`
      : `تم تسليم طلبك ${order.id}`;
  const safeDetails = escapeHtml(deliveryDetails.trim());
  const createdAt = new Date(order.createdAt).toLocaleString(isAr ? 'ar-IQ' : 'en-US');
  const updatedAt = new Date(order.updatedAt).toLocaleString(isAr ? 'ar-IQ' : 'en-US');

  const text =
    !isAr
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
    <div style="background:#05070a;margin:0;padding:28px 14px;font-family:${isAr ? 'Tajawal,Arial,sans-serif' : 'Outfit,Arial,sans-serif'};line-height:1.7;color:#f1f5f9;direction:${isAr ? 'rtl' : 'ltr'}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#12141c;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden">
        <tr>
          <td style="padding:20px 22px;background:linear-gradient(135deg,#ff6b00 0%,#b500ff 100%);color:#fff">
            <div style="font-size:18px;font-weight:800;letter-spacing:0.3px">GTX GAMING</div>
            <div style="font-size:13px;opacity:.9">${
              isAr ? 'إشعار تسليم الطلب' : 'Order Delivery Notification'
            }</div>
          </td>
        </tr>
        <tr>
          <td style="padding:22px">
            <p style="margin:0 0 10px;font-size:14px">${isAr ? 'مرحباً،' : 'Hello,'}</p>
            <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#fff">
              ${
                isAr
                  ? `تم تسليم طلبك رقم <span style="color:#ffb27b">${escapeHtml(order.id)}</span> بنجاح.`
                  : `Your order <span style="color:#ffb27b">${escapeHtml(order.id)}</span> has been delivered successfully.`
              }
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 8px">
              <tr>
                <td style="background:#0a0c12;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:10px 12px">
                  <div style="font-size:11px;color:#94a3b8">${isAr ? 'رقم الطلب' : 'Order ID'}</div>
                  <div style="font-size:13px;font-weight:700;color:#fff">${escapeHtml(order.id)}</div>
                </td>
                <td style="width:8px"></td>
                <td style="background:#0a0c12;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:10px 12px">
                  <div style="font-size:11px;color:#94a3b8">${isAr ? 'الحالة' : 'Status'}</div>
                  <div style="font-size:13px;font-weight:700;color:#4ade80">${isAr ? 'تم التسليم' : 'Delivered'}</div>
                </td>
              </tr>
            </table>

            <div style="margin-top:10px;background:#0a0c12;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:12px">
              <div style="font-size:11px;color:#94a3b8;margin-bottom:5px">${isAr ? 'تفاصيل التسليم' : 'Delivery details'}</div>
              <div style="font-size:13px;color:#f1f5f9;white-space:pre-line">${safeDetails.replace(/\n/g, '<br/>')}</div>
            </div>

            <div style="margin-top:10px;background:#0a0c12;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:12px">
              <div style="font-size:11px;color:#94a3b8;margin-bottom:6px">${isAr ? 'ملخص الطلب' : 'Order summary'}</div>
              <div style="font-size:12px;color:#cbd5e1">${isAr ? 'المجموع النهائي' : 'Final total'}: <strong style="color:#fff">${iqd(order.subtotal)}</strong></div>
              <div style="font-size:12px;color:#cbd5e1">${isAr ? 'تاريخ الإنشاء' : 'Created at'}: ${escapeHtml(createdAt)}</div>
              <div style="font-size:12px;color:#cbd5e1">${isAr ? 'آخر تحديث' : 'Updated at'}: ${escapeHtml(updatedAt)}</div>
            </div>

            <div style="margin-top:18px;text-align:center">
              <a href="${orderUrl}" style="display:inline-block;padding:11px 16px;border-radius:999px;background:#ff6b00;color:#fff;text-decoration:none;font-weight:700;font-size:13px">
                ${isAr ? 'عرض حالة الطلب' : 'View order status'}
              </a>
            </div>

            <p style="margin:14px 0 0;font-size:11px;color:#94a3b8;text-align:center">
              ${isAr ? 'يمكنك الرجوع لهذا الرابط في أي وقت لمتابعة حالة طلبك.' : 'You can use this link anytime to track your order.'}
            </p>
          </td>
        </tr>
      </table>
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

