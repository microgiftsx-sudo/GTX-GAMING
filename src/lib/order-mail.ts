import type { OrderRecord, OrderStatus } from '@/lib/orders';
import nodemailer from 'nodemailer';
import '@/lib/load-env';

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

function statusLabel(status: OrderStatus, isAr: boolean): string {
  if (isAr) {
    switch (status) {
      case 'pending':
        return 'قيد المراجعة';
      case 'processing':
        return 'قيد المعالجة';
      case 'completed':
        return 'تم التسليم';
      case 'on_hold':
        return 'معلّق';
      case 'refunded':
        return 'مسترجع';
      case 'cancelled':
        return 'ملغي';
    }
  }
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Processing';
    case 'completed':
      return 'Delivered';
    case 'on_hold':
      return 'On Hold';
    case 'refunded':
      return 'Refunded';
    case 'cancelled':
      return 'Cancelled';
  }
}

async function getMailer() {
  const smtpHost = (process.env.ORDER_SMTP_HOST ?? process.env.SMTP_HOST)?.trim();
  const smtpPort = Number(process.env.ORDER_SMTP_PORT ?? process.env.SMTP_PORT ?? 465);
  const smtpUser = (process.env.ORDER_SMTP_USER ?? process.env.SMTP_USER)?.trim();
  const smtpPass = (process.env.ORDER_SMTP_PASS ?? process.env.SMTP_PASS)?.trim();
  const smtpSecureRaw = (process.env.ORDER_SMTP_SECURE ?? process.env.SMTP_SECURE)?.trim();
  const smtpSecure = smtpSecureRaw ? smtpSecureRaw.toLowerCase() !== 'false' : smtpPort === 465;
  const from = (process.env.ORDER_EMAIL_FROM ?? process.env.SMTP_FROM ?? process.env.EMAIL_FROM)?.trim();
  if (!smtpHost || !smtpUser || !smtpPass || !from) {
    console.warn(
      '[mail] SMTP is not fully configured. Missing one of ORDER_SMTP_HOST/ORDER_SMTP_USER/ORDER_SMTP_PASS/ORDER_EMAIL_FROM (or SMTP_* fallback vars).',
    );
    return null;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number.isFinite(smtpPort) && smtpPort > 0 ? smtpPort : 465,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
  return { transporter, from };
}

export async function sendOrderStatusEmail(
  order: OrderRecord,
  status: OrderStatus,
  extraDetails?: string,
): Promise<void> {
  const mailer = await getMailer();
  if (!mailer) return;

  const orderUrl = orderPublicUrl(order);
  const isAr = order.locale !== 'en';
  const statusText = statusLabel(status, isAr);
  const subject =
    isAr
      ? `تحديث حالة طلبك ${order.id}: ${statusText}`
      : `Order ${order.id} status updated: ${statusText}`;
  const safeDetails = escapeHtml((extraDetails ?? '').trim());
  const createdAt = new Date(order.createdAt).toLocaleString(isAr ? 'ar-IQ' : 'en-US');
  const updatedAt = new Date(order.updatedAt).toLocaleString(isAr ? 'ar-IQ' : 'en-US');

  const text =
    isAr
      ? [
          `مرحباً،`,
          ``,
          `تم تحديث حالة طلبك رقم ${order.id}.`,
          `الحالة الجديدة: ${statusText}`,
          ...(extraDetails?.trim() ? [`التفاصيل: ${extraDetails.trim()}`] : []),
          ``,
          `رابط متابعة الطلب: ${orderUrl}`,
          ``,
          `شكراً لثقتك بنا.`,
        ].join('\n')
      : [
          `Hello,`,
          ``,
          `Your order ${order.id} status was updated.`,
          `New status: ${statusText}`,
          ...(extraDetails?.trim() ? [`Details: ${extraDetails.trim()}`] : []),
          ``,
          `View order status: ${orderUrl}`,
          ``,
          `Thank you for shopping with us.`,
        ].join('\n');

  const html = `
    <div style="background:#05070a;margin:0;padding:28px 14px;font-family:${isAr ? 'Tajawal,Arial,sans-serif' : 'Outfit,Arial,sans-serif'};line-height:1.7;color:#f1f5f9;direction:${isAr ? 'rtl' : 'ltr'}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#12141c;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden">
        <tr>
          <td style="padding:20px 22px;background:linear-gradient(135deg,#ff6b00 0%,#b500ff 100%);color:#fff">
            <div style="font-size:18px;font-weight:800;letter-spacing:0.3px">GTX GAMING</div>
            <div style="font-size:13px;opacity:.9">${isAr ? 'تحديث حالة الطلب' : 'Order Status Update'}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:22px">
            <p style="margin:0 0 10px;font-size:14px">${isAr ? 'مرحباً،' : 'Hello,'}</p>
            <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#fff">
              ${isAr ? `تم تحديث حالة طلبك رقم <span style="color:#ffb27b">${escapeHtml(order.id)}</span>.` : `Your order <span style="color:#ffb27b">${escapeHtml(order.id)}</span> has been updated.`}
            </p>

            <div style="margin-top:10px;background:#0a0c12;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:12px">
              <div style="font-size:11px;color:#94a3b8;margin-bottom:5px">${isAr ? 'الحالة الحالية' : 'Current status'}</div>
              <div style="font-size:14px;font-weight:700;color:#4ade80">${escapeHtml(statusText)}</div>
            </div>

            ${safeDetails ? `<div style="margin-top:10px;background:#0a0c12;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:12px"><div style="font-size:11px;color:#94a3b8;margin-bottom:5px">${isAr ? 'تفاصيل إضافية' : 'Additional details'}</div><div style="font-size:13px;color:#f1f5f9;white-space:pre-line">${safeDetails.replace(/\n/g, '<br/>')}</div></div>` : ''}

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
          </td>
        </tr>
      </table>
    </div>
  `;

  try {
    await mailer.transporter.sendMail({
      from: mailer.from,
      to: order.email,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error('[mail] Failed to send order status email', {
      orderId: order.id,
      to: order.email,
      status,
      error,
    });
    throw error;
  }
}

export async function sendOrderDeliveredEmail(
  order: OrderRecord,
  deliveryDetails: string,
): Promise<void> {
  await sendOrderStatusEmail(order, 'completed', deliveryDetails);
}

export async function sendOrderCreatedEmail(order: OrderRecord): Promise<void> {
  const isAr = order.locale !== 'en';
  const details = isAr
    ? `تم إنشاء طلبك بنجاح. رقم الطلب: ${order.id}`
    : `Your order was created successfully. Order ID: ${order.id}`;
  await sendOrderStatusEmail(order, order.status, details);
}

export async function sendWelcomeEmail(email: string, locale: string): Promise<void> {
  const mailer = await getMailer();
  if (!mailer) return;
  const isAr = locale !== 'en';
  const base = appBaseUrl().replace(/\/+$/, '');
  const subject = isAr ? 'مرحباً بك في GTX GAMING' : 'Welcome to GTX GAMING';
  const text =
    isAr
      ? [
          `مرحباً بك في GTX GAMING.`,
          `تم إنشاء حسابك عبر Google بنجاح ويمكنك الآن البدء بالتسوق.`,
          ``,
          `رابط الموقع: ${base}`,
        ].join('\n')
      : [
          `Hello,`,
          `Welcome to GTX GAMING.`,
          `You can now browse products and place orders.`,
          ``,
          `Visit: ${base}`,
        ].join('\n')
      ;

  const html = `
    <div style="background:#05070a;margin:0;padding:28px 14px;font-family:${isAr ? 'Tajawal,Arial,sans-serif' : 'Outfit,Arial,sans-serif'};line-height:1.7;color:#f1f5f9;direction:${isAr ? 'rtl' : 'ltr'}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#12141c;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden">
        <tr>
          <td style="padding:20px 22px;background:linear-gradient(135deg,#ff6b00 0%,#b500ff 100%);color:#fff">
            <div style="font-size:18px;font-weight:800;letter-spacing:0.3px">GTX GAMING</div>
            <div style="font-size:13px;opacity:.9">${isAr ? 'مرحباً بك' : 'Welcome'}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:22px">
            <p style="margin:0 0 10px;font-size:14px">${isAr ? 'مرحباً،' : 'Hello,'}</p>
            <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#fff">${isAr ? 'تم تسجيلك بنجاح عبر Google.' : 'You signed in successfully with Google.'}</p>

            <div style="margin-top:18px;text-align:center">
              <a href="${base}" style="display:inline-block;padding:11px 16px;border-radius:999px;background:#ff6b00;color:#fff;text-decoration:none;font-weight:700;font-size:13px">
                ${isAr ? 'الذهاب للمتجر' : 'Go to store'}
              </a>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;

  try {
    await mailer.transporter.sendMail({
      from: mailer.from,
      to: email,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error('[mail] Failed to send welcome email', { to: email, error });
    throw error;
  }
}

