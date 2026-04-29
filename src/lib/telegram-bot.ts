import {
  getOrder,
  listOrders,
  markOrderDelivered,
  markOrderDeliveryNotified,
  listPaymentMethods,
  OrderRecord,
  OrderStatus,
  PaymentMethod,
  savePaymentMethods,
  updatePaymentMethod,
  updateOrderStatus,
} from '@/lib/orders';
import { orderPublicUrl, sendOrderDeliveredEmail } from '@/lib/order-mail';
import {
  clearPendingPaymentEdit,
  getPendingPaymentEdit,
  setPendingPaymentEdit,
  type PaymentEditField,
} from '@/lib/payment-edit-state';
import {
  clearPendingOrderDelivery,
  getPendingOrderDelivery,
  setPendingOrderDelivery,
} from '@/lib/order-delivery-state';
import {
  applyTaxToBaseIqd,
  getTaxRatePercent,
  setTaxRatePercent,
  taxAmountFromBase,
} from '@/lib/tax';
import {
  createCoupon,
  listCoupons,
  normalizeCouponCode,
  setCouponActive,
} from '@/lib/coupons';
import {
  DEFAULT_HERO_CACHE_TTL_SECONDS,
  getHeroCacheTtlSeconds,
  getHeroProductIds,
  normalizeHeroCacheTtlSeconds,
  setHeroCacheTtlSeconds,
  setHeroProductIds,
} from '@/lib/hero-products';
import {
  getTrendingProductIds,
  setTrendingProductIds,
} from '@/lib/trending-products';
import {
  getCatalogProvider,
  setCatalogProvider,
  type CatalogProvider,
} from '@/lib/catalog-provider';
import {
  getSearchTranslateSettings,
  setSearchTranslateSettings,
} from '@/lib/search-translate-settings';
import {
  getTelegramUserLang,
  setTelegramUserLang,
  type TelegramLang,
} from '@/lib/telegram-language-state';
import {
  addSupportAgentReply,
  getSupportTicket,
} from '@/lib/support-tickets';

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    from?: { id: number };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number };
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
};

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? '';
const ADMIN_IDS = new Set(
  (process.env.TELEGRAM_ADMIN_IDS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => Number(x)),
);

export type SupportTelegramPayload = {
  ticketId: string;
  message: string;
  attachment?: { kind: 'image' | 'video'; url: string; fileName: string };
  mediaUpload?: {
    kind: 'image' | 'video';
    bytes: Uint8Array;
    fileName: string;
    contentType: string;
  };
  locale?: string;
  pageUrl?: string;
};

function hasBotConfig() {
  return BOT_TOKEN.length > 0;
}

async function callTelegram<T>(method: string, body: Record<string, unknown>) {
  if (!hasBotConfig()) return;
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as TelegramApiResponse<T>;
  if (!data.ok) {
    throw new Error(data.description ?? 'Telegram API failed');
  }
  return data.result;
}

async function callTelegramMultipart<T>(method: string, form: FormData) {
  if (!hasBotConfig()) return;
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    body: form,
  });
  const data = (await response.json()) as TelegramApiResponse<T>;
  if (!data.ok) {
    throw new Error(data.description ?? 'Telegram API failed');
  }
  return data.result;
}

function statusLabel(status: OrderStatus) {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'on_hold':
      return 'On Hold';
    case 'refunded':
      return 'Refunded';
    case 'cancelled':
      return 'Cancelled';
  }
}

function statusLabelByLang(status: OrderStatus, lang: TelegramLang) {
  if (lang === 'ar') {
    switch (status) {
      case 'pending':
        return 'قيد المراجعة';
      case 'processing':
        return 'قيد المعالجة';
      case 'completed':
        return 'مكتمل';
      case 'on_hold':
        return 'معلّق';
      case 'refunded':
        return 'مسترجع';
      case 'cancelled':
        return 'ملغي';
    }
  }
  return statusLabel(status);
}

function orderKeyboard(order: OrderRecord, lang: TelegramLang = 'en') {
  const productButtons = order.items.slice(0, 2).map((item, idx) => ({
    text: lang === 'ar' ? `المنتج ${idx + 1}` : `Product ${idx + 1}`,
    url: item.kinguinUrl,
  }));

  const rows: { text: string; callback_data?: string; url?: string }[][] = [];
  if (productButtons.length > 0) {
    rows.push(productButtons);
  }
  rows.push(
    [
      {
        text: lang === 'ar' ? 'موافقة + تفاصيل' : 'Approve + details',
        callback_data: `order:set:${order.id}:completed`,
      },
      { text: lang === 'ar' ? 'قيد المعالجة' : 'Processing', callback_data: `order:set:${order.id}:processing` },
    ],
    [
      { text: lang === 'ar' ? 'تعليق' : 'Hold', callback_data: `order:set:${order.id}:on_hold` },
      { text: lang === 'ar' ? 'استرجاع' : 'Refund', callback_data: `order:set:${order.id}:refunded` },
    ],
    [{ text: lang === 'ar' ? 'إلغاء' : 'Cancel', callback_data: `order:set:${order.id}:cancelled` }],
    [{ text: lang === 'ar' ? 'طرق الدفع' : 'Payment Methods', callback_data: 'payment:list' }],
  );

  return { inline_keyboard: rows };
}

function orderMessage(order: OrderRecord, lang: TelegramLang = 'en') {
  const isAr = lang === 'ar';
  const lines = [
    `${isAr ? '🧾 طلب جديد' : '🧾 New Order'}: ${order.id}`,
    `${isAr ? 'الحالة' : 'Status'}: ${statusLabelByLang(order.status, lang)}`,
    `Email: ${order.email}`,
    `${isAr ? 'الدفع' : 'Payment'}: ${order.paymentMethodName}`,
  ];
  const discount = order.discountAmount ?? 0;
  const hasCoupon = discount > 0 && Boolean(order.couponCode);
  const afterTaxBeforeCoupon = hasCoupon ? order.subtotal + discount : order.subtotal;

  if (
    order.taxRatePercent != null &&
    order.taxRatePercent > 0 &&
    order.subtotalBeforeTax != null
  ) {
    lines.push(
      `${isAr ? 'المجموع قبل الضريبة' : 'Subtotal (before tax)'}: ${order.subtotalBeforeTax.toLocaleString('en-US')} IQD`,
      `${isAr ? 'الضريبة' : 'Tax'} (${order.taxRatePercent}%): ${(order.taxAmount ?? 0).toLocaleString('en-US')} IQD`,
      `${isAr ? 'الإجمالي بعد الضريبة' : 'Total after tax'}: ${afterTaxBeforeCoupon.toLocaleString('en-US')} IQD`,
    );
    if (hasCoupon && order.couponCode) {
      lines.push(
        `${isAr ? 'كوبون' : 'Coupon'} ${order.couponCode} (${order.couponPercentOff ?? '?'}%): −${discount.toLocaleString('en-US')} IQD`,
        `${isAr ? 'المبلغ المطلوب' : 'Amount due'} (IQD): ${order.subtotal.toLocaleString('en-US')}`,
      );
    }
  } else if (hasCoupon && order.couponCode) {
    lines.push(
      `${isAr ? 'المجموع بعد الضريبة' : 'Subtotal (after tax)'}: ${afterTaxBeforeCoupon.toLocaleString('en-US')} IQD`,
      `${isAr ? 'كوبون' : 'Coupon'} ${order.couponCode} (${order.couponPercentOff ?? '?'}%): −${discount.toLocaleString('en-US')} IQD`,
      `${isAr ? 'المبلغ المطلوب' : 'Amount due'} (IQD): ${order.subtotal.toLocaleString('en-US')}`,
    );
  } else {
    lines.push(`${isAr ? 'المجموع' : 'Subtotal'} (IQD): ${order.subtotal.toLocaleString('en-US')}`);
  }
  lines.push(
    `${isAr ? 'تاريخ الإنشاء' : 'Created'}: ${order.createdAt}`,
    '',
    isAr ? 'المنتجات (سعر الوحدة / IQD):' : 'Items (unit list / IQD):',
    ...order.items.map(
      (item) => `• ${item.title} x${item.quantity} (${item.price.toLocaleString('en-US')} IQD)`,
    ),
  );
  return lines.join('\n');
}

function combinedDeliveryDetails(order: OrderRecord, perProductDetails: string[]) {
  return order.items
    .map((item, idx) => {
      const details = perProductDetails[idx]?.trim() ?? '';
      return `Product ${idx + 1}: ${item.title}\n${details || '-'}`;
    })
    .join('\n\n');
}

const TELEGRAM_CAPTION_MAX = 1024;

function orderCaptionForPhoto(order: OrderRecord, lang: TelegramLang = 'en') {
  const text = orderMessage(order, lang);
  if (text.length <= TELEGRAM_CAPTION_MAX) return text;
  return `${text.slice(0, TELEGRAM_CAPTION_MAX - 3)}...`;
}

async function sendOrderPhotoWithCaption(
  chatId: number | string,
  photoUrl: string,
  caption: string,
  replyMarkup: Record<string, unknown>,
) {
  await callTelegram('sendPhoto', {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    reply_markup: replyMarkup,
  });
}

async function sendText(chatId: number | string, text: string, replyMarkup?: Record<string, unknown>) {
  await callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup,
  });
}

function isAllowedAdmin(userId: number) {
  if (ADMIN_IDS.size === 0) return true;
  return ADMIN_IDS.has(userId);
}

function paymentMethodsText(lang: TelegramLang) {
  return lang === 'ar' ? 'التحكم بطرق الدفع:' : 'Payment methods control:';
}

const FIELD_CODE: Record<'n' | 'a' | 'b' | 'i', PaymentEditField> = {
  n: 'name',
  a: 'account',
  b: 'barcodeUrl',
  i: 'icon',
};

function formatMethodEditText(method: PaymentMethod, lang: TelegramLang = 'en') {
  const barcode = method.barcodeUrl?.trim() ? method.barcodeUrl : '(not set)';
  const isAr = lang === 'ar';
  return [
    `${isAr ? '✏️ تعديل' : '✏️ Edit'}: ${method.name}`,
    `ID: ${method.id}`,
    `${isAr ? 'الحساب' : 'Account'}: ${method.account}`,
    `${isAr ? 'الباركود' : 'Barcode'}: ${barcode}`,
    `Icon: ${method.icon}`,
    '',
    isAr ? 'اختر الحقل ثم أرسل القيمة الجديدة في الرسالة التالية.' : 'Choose a field, then send the new value in the next message.',
  ].join('\n');
}

function editMenuKeyboard(methodId: string, lang: TelegramLang = 'en') {
  const isAr = lang === 'ar';
  return {
    inline_keyboard: [
      [
        { text: isAr ? 'الاسم' : 'Name', callback_data: `payment:field:${methodId}:n` },
        { text: isAr ? 'الحساب' : 'Account', callback_data: `payment:field:${methodId}:a` },
      ],
      [
        { text: isAr ? 'رابط الباركود' : 'Barcode URL', callback_data: `payment:field:${methodId}:b` },
        { text: isAr ? 'رابط الأيقونة' : 'Icon URL', callback_data: `payment:field:${methodId}:i` },
      ],
      [
        { text: isAr ? '← رجوع' : '← Back', callback_data: 'payment:back:list' },
        { text: isAr ? 'إلغاء الإدخال' : 'Cancel input', callback_data: 'payment:cancel:pending' },
      ],
    ],
  };
}

async function buildPaymentMethodsReplyMarkup(lang: TelegramLang = 'en') {
  const methods = await listPaymentMethods();
  const keyboard = methods.map((method) => [
    {
      text: `${method.enabled ? '✅' : '❌'} ${method.name}`,
      callback_data: `payment:toggle:${method.id}`,
    },
    { text: lang === 'ar' ? '✏️ تعديل' : '✏️', callback_data: `payment:editmenu:${method.id}` },
  ]);
  keyboard.push([{ text: lang === 'ar' ? 'تحديث الطلبات' : 'Refresh Orders', callback_data: 'order:list' }]);
  return { inline_keyboard: keyboard };
}

async function sendPaymentMethods(chatId: number, lang: TelegramLang = 'en') {
  const reply_markup = await buildPaymentMethodsReplyMarkup(lang);
  await sendText(chatId, paymentMethodsText(lang), reply_markup);
}

async function editPaymentMethodsMessage(chatId: number, messageId: number, lang: TelegramLang = 'en') {
  const reply_markup = await buildPaymentMethodsReplyMarkup(lang);
  await callTelegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: paymentMethodsText(lang),
    reply_markup,
  });
}

async function editPaymentEditMenuMessage(
  chatId: number,
  messageId: number,
  method: PaymentMethod,
  lang: TelegramLang = 'en',
) {
  await callTelegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: formatMethodEditText(method, lang),
    reply_markup: editMenuKeyboard(method.id, lang),
  });
}

async function editPaymentPromptMessage(
  chatId: number,
  messageId: number,
  method: PaymentMethod,
  field: PaymentEditField,
) {
  const labels: Record<PaymentEditField, string> = {
    name: 'display name',
    account: 'account number / wallet ID',
    barcodeUrl: 'barcode/QR image URL (https://…)',
    icon: 'icon image URL or path (e.g. /icons/zaincash.png)',
  };
  const text = [
    `⌨️ Send new ${labels[field]} for «${method.name}»`,
    `(id: ${method.id})`,
    '',
    'Send /cancel to abort.',
  ].join('\n');
  await callTelegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: {
      inline_keyboard: [[{ text: 'Cancel', callback_data: 'payment:cancel:pending' }]],
    },
  });
}

async function sendRecentOrders(chatId: number, lang: TelegramLang = 'en') {
  const orders = await listOrders();
  if (orders.length === 0) {
    await sendText(chatId, lang === 'ar' ? 'لا توجد طلبات بعد.' : 'No orders yet.');
    return;
  }
  const sample = orders.slice(0, 5);
  await sendText(
    chatId,
    sample
      .map((order) => `${order.id} | ${statusLabelByLang(order.status, lang)} | ${order.subtotal.toLocaleString('en-US')} IQD`)
      .join('\n'),
  );
}

async function answerCallbackQuery(callbackQueryId: string, text: string) {
  await callTelegram('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
}

/** Parse /hero_ttl argument: 3600, 2h, 45m, 90s */
function parseHeroTtlToSeconds(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  const h = /^(\d+)\s*h$/.exec(t);
  if (h) return Number(h[1]) * 3600;
  const m = /^(\d+)\s*m$/.exec(t);
  if (m) return Number(m[1]) * 60;
  const s = /^(\d+)\s*s$/.exec(t);
  if (s) return Number(s[1]);
  if (/^\d+$/.test(t)) return Number(t);
  return null;
}

function formatHeroTtlHuman(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) {
    const h = seconds / 3600;
    return `${h}h`;
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    const m = seconds / 60;
    return `${m}m`;
  }
  return `${seconds}s`;
}

function startHelpText(lang: TelegramLang) {
  if (lang === 'ar') {
    return [
      'بوت GTX جاهز.',
      'الأوامر:',
      '/orders — عرض آخر الطلبات',
      '/payments — إدارة طرق الدفع والتعديل',
      '/tax — عرض/تعديل نسبة الضريبة',
      '/calc AMOUNT — حاسبة الضريبة',
      '/gencoupon PERCENT [maxUses] [days] — إنشاء كوبون',
      '/coupons — عرض الكوبونات',
      '/coupon_off CODE — تعطيل كوبون',
      '/hero — إدارة منتجات الهيرو',
      '/trending — إدارة منتجات الترند',
      `/hero_ttl — مدة كاش الهيرو (الافتراضي ${DEFAULT_HERO_CACHE_TTL_SECONDS / 3600}h)`,
      '/catalog — مصدر الكاتالوج',
      '/searchtranslate — إعداد ترجمة البحث',
      '/deliver ORDER_ID DELIVERY_TEXT — تسليم الطلب وإرسال الإيميل',
      '/ticket TICKET_ID — عرض محادثة عميل',
      '/reply TICKET_ID MESSAGE — الرد على التذكرة',
    ].join('\n');
  }
  return [
    'GTX Bot ready.',
    'Commands:',
    '/orders — recent orders',
    '/payments — toggle methods; tap ✏️ to edit name, account, barcode URL, icon',
    '/tax — show VAT %; set: /tax 5',
    '/calc AMOUNT — tax calculator (IQD); optional: /calc 50000 10',
    '/gencoupon PERCENT [maxUses] [days] — create discount code',
    '/coupons — list coupons',
    '/coupon_off CODE — disable a coupon',
    '/hero — hero carousel product IDs; set: /hero 123 456; clear: /hero clear',
    '/trending — home trending strip IDs; set: /trending 123 456; clear: /trending clear',
    `/hero_ttl — cache window (default ${DEFAULT_HERO_CACHE_TTL_SECONDS / 3600}h); set: /hero_ttl 6h or /hero_ttl 3600`,
    '/catalog — show catalog source; set: /catalog kinguin | /catalog plati',
    '/searchtranslate — Arabic→En search for catalog; see /searchtranslate (no args) for status & usage',
    '/deliver ORDER_ID DELIVERY_TEXT — mark completed + email customer with order link',
    '/ticket TICKET_ID — view customer live chat ticket',
    '/reply TICKET_ID MESSAGE — send agent reply to ticket',
  ].join('\n');
}

function normalizeFieldValue(field: PaymentEditField, raw: string): string {
  const v = raw.trim();
  if (field === 'barcodeUrl' || field === 'icon') {
    if (v === '' || v.toLowerCase() === 'none' || v.toLowerCase() === 'clear') return '';
    if (field === 'barcodeUrl' && v.length > 0 && !/^https?:\/\//i.test(v)) {
      throw new Error('Barcode URL must start with http:// or https://');
    }
  }
  return v;
}

export async function sendOrderToTelegram(order: OrderRecord) {
  if (!DEFAULT_CHAT_ID) return;
  const kb = orderKeyboard(order, 'en');
  const caption = orderCaptionForPhoto(order, 'en');
  const receipt = order.receiptUrl?.trim() ?? '';
  const canUsePhoto = /^https?:\/\//i.test(receipt);

  if (canUsePhoto) {
    try {
      await sendOrderPhotoWithCaption(DEFAULT_CHAT_ID, receipt, caption, kb);
      return;
    } catch {
      await sendText(
        DEFAULT_CHAT_ID,
        `${orderMessage(order, 'en')}\n\nProof: ${receipt}`,
        kb,
      );
      return;
    }
  }

  await sendText(DEFAULT_CHAT_ID, orderMessage(order, 'en'), kb);
}

export async function sendSupportTicketMessageToTelegram(payload: SupportTelegramPayload) {
  if (!DEFAULT_CHAT_ID) return;
  const header = [
    '💬 Live Chat Ticket',
    `Ticket: ${payload.ticketId}`,
    `Locale: ${payload.locale ?? '-'}`,
    payload.pageUrl ? `Page: ${payload.pageUrl}` : '',
  ].filter(Boolean).join('\n');
  const lines = [
    header,
    '',
    payload.message ? `Customer: ${payload.message}` : 'Customer sent media attachment.',
    '',
    `Reply command: /reply ${payload.ticketId} your message`,
  ].filter(Boolean);
  if (payload.mediaUpload) {
    const caption = lines.join('\n').slice(0, 1000);
    try {
      const form = new FormData();
      form.set('chat_id', String(DEFAULT_CHAT_ID));
      form.set('caption', caption);
      const blob = new Blob([payload.mediaUpload.bytes], {
        type: payload.mediaUpload.contentType || 'application/octet-stream',
      });
      if (payload.mediaUpload.kind === 'image') {
        form.set('photo', blob, payload.mediaUpload.fileName || 'image');
        await callTelegramMultipart('sendPhoto', form);
      } else {
        form.set('video', blob, payload.mediaUpload.fileName || 'video');
        await callTelegramMultipart('sendVideo', form);
      }
      return;
    } catch {
      // Fallback to plain text with media URL.
      await sendText(
        DEFAULT_CHAT_ID,
        `${lines.join('\n')}${payload.attachment?.url ? `\nMedia: ${payload.attachment.url}` : ''}`,
      );
      return;
    }
  }
  if (payload.attachment) {
    await sendText(DEFAULT_CHAT_ID, `${lines.join('\n')}\nMedia: ${payload.attachment.url}`);
    return;
  }
  await sendText(DEFAULT_CHAT_ID, lines.join('\n'));
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  if (!hasBotConfig()) return;

  if (update.message?.text && update.message.from?.id) {
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    const lang = await getTelegramUserLang(userId);
    if (!isAllowedAdmin(userId)) {
      await sendText(chatId, lang === 'ar' ? 'غير مصرح.' : 'Unauthorized.');
      return;
    }
    const text = update.message.text.trim();

    if (text === '/start') {
      await clearPendingPaymentEdit(userId);
      await clearPendingOrderDelivery(userId);
      await sendText(
        chatId,
        lang === 'ar' ? 'اختر اللغة:' : 'Choose language:',
        {
          inline_keyboard: [
            [
              { text: 'العربية', callback_data: 'lang:set:ar' },
              { text: 'English', callback_data: 'lang:set:en' },
            ],
          ],
        },
      );
      return;
    }
    if (text === '/orders') {
      await clearPendingPaymentEdit(userId);
      await clearPendingOrderDelivery(userId);
      await sendRecentOrders(chatId, lang);
      return;
    }
    if (text === '/payments') {
      await clearPendingPaymentEdit(userId);
      await clearPendingOrderDelivery(userId);
      await sendPaymentMethods(chatId, lang);
      return;
    }

    const cmdToken = text.split(/\s+/)[0]?.split('@')[0] ?? '';

    if (cmdToken === '/catalog' || text.startsWith('/catalog ')) {
      await clearPendingPaymentEdit(userId);
      await clearPendingOrderDelivery(userId);
      const parts = text.trim().split(/\s+/);
      if (parts.length === 1) {
        const p = await getCatalogProvider();
        await sendText(
          chatId,
          `Catalog provider: ${p}\n\nSwitch:\n/catalog kinguin\n/catalog plati`,
        );
        return;
      }
      const raw = parts[1]?.toLowerCase();
      let next: CatalogProvider | null = null;
      if (raw === 'kinguin' || raw === 'kg') next = 'kinguin';
      if (raw === 'plati' || raw === 'digiseller' || raw === 'plati.market') next = 'plati';
      if (!next) {
        await sendText(chatId, 'Usage: /catalog kinguin  or  /catalog plati');
        return;
      }
      const saved = await setCatalogProvider(next);
      await sendText(
        chatId,
        `Catalog provider set to: ${saved}. Listing, hero, and trending caches were invalidated.`,
      );
      return;
    }

    if (cmdToken === '/searchtranslate' || text.startsWith('/searchtranslate ')) {
      await clearPendingPaymentEdit(userId);
      await clearPendingOrderDelivery(userId);
      const parts = text.trim().split(/\s+/);
      if (parts.length === 1) {
        const s = await getSearchTranslateSettings();
        await sendText(
          chatId,
          [
            'Arabic → English catalog search (Plati/Kinguin `q`):',
            `enabled: ${s.enabled}`,
            `mode: ${s.mode}  (full = overrides JSON + MyMemory; dictionary = overrides only)`,
            `myMemory email: ${s.myMemoryEmail || '(none)'}`,
            '',
            'Commands:',
            '/searchtranslate on | off',
            '/searchtranslate mode full | dictionary',
            '/searchtranslate email you@example.com',
            '/searchtranslate email clear',
          ].join('\n'),
        );
        return;
      }
      const sub = (parts[1] ?? '').toLowerCase();
      if (sub === 'on' || sub === 'enable') {
        await setSearchTranslateSettings({ enabled: true });
        await sendText(chatId, 'search-translate: enabled ON.');
        return;
      }
      if (sub === 'off' || sub === 'disable') {
        await setSearchTranslateSettings({ enabled: false });
        await sendText(chatId, 'search-translate: enabled OFF.');
        return;
      }
      if (sub === 'mode') {
        const m = (parts[2] ?? '').toLowerCase();
        if (m !== 'full' && m !== 'dictionary') {
          await sendText(chatId, 'Usage: /searchtranslate mode full\nor: /searchtranslate mode dictionary');
          return;
        }
        const saved = await setSearchTranslateSettings({
          mode: m === 'dictionary' ? 'dictionary' : 'full',
        });
        await sendText(chatId, `search-translate mode: ${saved.mode}`);
        return;
      }
      if (sub === 'email') {
        const addr = parts.slice(2).join(' ').trim();
        if (!addr || addr.toLowerCase() === 'clear' || addr === '-') {
          await setSearchTranslateSettings({ myMemoryEmail: '' });
          await sendText(chatId, 'MyMemory contact email cleared.');
          return;
        }
        if (!addr.includes('@')) {
          await sendText(
            chatId,
            'Invalid email. Example: /searchtranslate email you@example.com\nClear: /searchtranslate email clear',
          );
          return;
        }
        const saved = await setSearchTranslateSettings({ myMemoryEmail: addr });
        await sendText(chatId, `MyMemory email saved: ${saved.myMemoryEmail}`);
        return;
      }
      await sendText(
        chatId,
        'Unknown. Try: /searchtranslate\nor: on | off | mode full | mode dictionary | email …',
      );
      return;
    }

    if (cmdToken === '/tax' || text.startsWith('/tax ')) {
      await clearPendingPaymentEdit(userId);
      await clearPendingOrderDelivery(userId);
      const parts = text.split(/\s+/);
      if (parts.length === 1) {
        const r = await getTaxRatePercent();
        await sendText(
          chatId,
          `VAT / tax rate: ${r}%\n\nSet: /tax 5\nCalculator: /calc 50000\n(or /calc 50000 10 for 10% one-off)`,
        );
        return;
      }
      const rate = Number(parts[1]);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        await sendText(chatId, 'Usage: /tax 0–100 (e.g. /tax 5 for 5%)');
        return;
      }
      const next = await setTaxRatePercent(rate);
      await sendText(
        chatId,
        `Tax rate set to ${next}%. List prices on the store will show this VAT; checkout totals match.`,
      );
      return;
    }

    if (cmdToken === '/calc' || text.startsWith('/calc ')) {
      await clearPendingPaymentEdit(userId);
      await clearPendingOrderDelivery(userId);
      const parts = text.split(/\s+/);
      if (parts.length < 2) {
        await sendText(
          chatId,
          'Usage: /calc AMOUNT_IQD\nExample: /calc 50000\nOptional: /calc 50000 10 (use 10% instead of current rate)',
        );
        return;
      }
      const amount = Number(parts[1]);
      if (!Number.isFinite(amount) || amount < 0) {
        await sendText(chatId, 'Invalid amount.');
        return;
      }
      const rate =
        parts.length >= 3 ? Number(parts[2]) : await getTaxRatePercent();
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        await sendText(chatId, 'Invalid tax %.');
        return;
      }
      const total = applyTaxToBaseIqd(amount, rate);
      const tax = taxAmountFromBase(amount, rate);
      await sendText(
        chatId,
        [
          `Base: ${Math.round(amount).toLocaleString('en-US')} IQD`,
          `Tax (${rate}%): ${tax.toLocaleString('en-US')} IQD`,
          `Total: ${total.toLocaleString('en-US')} IQD`,
        ].join('\n'),
      );
      return;
    }

    if (cmdToken === '/gencoupon' || text.startsWith('/gencoupon ')) {
      await clearPendingPaymentEdit(userId);
      await clearPendingOrderDelivery(userId);
      const parts = text.split(/\s+/);
      if (parts.length < 2) {
        await sendText(
          chatId,
          [
            'Usage: /gencoupon PERCENT [maxUses] [expiresInDays]',
            'Examples:',
            '/gencoupon 15 → 15% off, 1 use',
            '/gencoupon 15 5 → 15% off, 5 uses',
            '/gencoupon 15 5 30 → 5 uses, expires in 30 days',
          ].join('\n'),
        );
        return;
      }
      const percent = Number(parts[1]);
      if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
        await sendText(chatId, 'PERCENT must be between 1 and 100.');
        return;
      }
      let maxUses: number | undefined;
      let expiresInDays: number | null | undefined;
      if (parts.length >= 3) {
        const mu = Number(parts[2]);
        if (!Number.isFinite(mu) || mu < 1 || mu > 1_000_000) {
          await sendText(chatId, 'maxUses must be between 1 and 1000000.');
          return;
        }
        maxUses = Math.floor(mu);
      }
      if (parts.length >= 4) {
        const d = Number(parts[3]);
        if (!Number.isFinite(d) || d < 1 || d > 3650) {
          await sendText(chatId, 'expiresInDays must be between 1 and 3650.');
          return;
        }
        expiresInDays = Math.floor(d);
      }
      const c = await createCoupon({
        percentOff: percent,
        maxUses,
        expiresInDays: expiresInDays ?? null,
      });
      const exp = c.expiresAt ? `\nExpires: ${c.expiresAt.slice(0, 10)} UTC` : '';
      await sendText(
        chatId,
        [
          '✅ Coupon created',
          `Code: ${c.code}`,
          `Discount: ${c.percentOff}%`,
          `Uses: ${c.usedCount}/${c.maxUses}`,
          exp,
        ]
          .filter(Boolean)
          .join('\n'),
      );
      return;
    }

    if (cmdToken === '/coupons') {
      await clearPendingPaymentEdit(userId);
      await clearPendingOrderDelivery(userId);
      const list = await listCoupons(20);
      if (list.length === 0) {
        await sendText(chatId, 'No coupons yet. Use /gencoupon');
        return;
      }
      const body = list
        .map((c) => {
          const status = c.active ? '✅' : '⛔';
          const exp = c.expiresAt ? ` exp ${c.expiresAt.slice(0, 10)}` : '';
          return `${status} ${c.code} ${c.percentOff}% · ${c.usedCount}/${c.maxUses}${exp}`;
        })
        .join('\n');
      await sendText(chatId, body);
      return;
    }

    if (cmdToken === '/hero_ttl' || text.startsWith('/hero_ttl ')) {
      await clearPendingPaymentEdit(userId);
      await clearPendingOrderDelivery(userId);
      const parts = text.trim().split(/\s+/);
      if (parts.length === 1) {
        const sec = await getHeroCacheTtlSeconds();
        await sendText(
          chatId,
          [
            '⏱ Hero carousel cache window (how long the same API response is reused):',
            `Current: ${formatHeroTtlHuman(sec)} (${sec}s)`,
            `Default: ${formatHeroTtlHuman(DEFAULT_HERO_CACHE_TTL_SECONDS)} (${DEFAULT_HERO_CACHE_TTL_SECONDS}s)`,
            '',
            'Set (60s–7d):',
            '/hero_ttl 3600   — seconds',
            '/hero_ttl 6h     — hours',
            '/hero_ttl 45m    — minutes',
          ].join('\n'),
        );
        return;
      }
      const raw = parts.slice(1).join(' ').trim();
      const parsed = parseHeroTtlToSeconds(raw);
      if (parsed == null) {
        await sendText(chatId, 'Invalid duration. Examples: /hero_ttl 7200  /hero_ttl 2h  /hero_ttl 30m');
        return;
      }
      const normalized = normalizeHeroCacheTtlSeconds(parsed);
      const saved = await setHeroCacheTtlSeconds(normalized);
      await sendText(
        chatId,
        `Hero cache window set to ${formatHeroTtlHuman(saved)} (${saved}s). Carousel refreshes on this interval (and when you change /hero IDs).`,
      );
      return;
    }

    if (cmdToken === '/hero' || text.startsWith('/hero ')) {
      await clearPendingPaymentEdit(userId);
      await clearPendingOrderDelivery(userId);
      const parts = text.trim().split(/\s+/);
      if (parts.length === 1) {
        const ids = await getHeroProductIds();
        const ttlSec = await getHeroCacheTtlSeconds();
        await sendText(
          chatId,
          [
            '🖼 Home hero — catalog product IDs:',
            ids.length ? ids.join(' → ') : '(none — carousel uses default catalog)',
            `⏱ Cache window: ${formatHeroTtlHuman(ttlSec)} (${ttlSec}s) — /hero_ttl to change`,
            '',
            `Set up to 6 IDs: /hero 12345 67890`,
            'Use default catalog again: /hero clear',
          ].join('\n'),
        );
        return;
      }
      if (parts[1].toLowerCase() === 'clear') {
        await setHeroProductIds([]);
        await sendText(
          chatId,
          'Hero cleared. Carousel will load the default featured list from the catalog.',
        );
        return;
      }
      const next = await setHeroProductIds(parts.slice(1));
      if (next.length === 0) {
        await sendText(
          chatId,
          'No valid numeric IDs. Send catalog product IDs, e.g. /hero 12345 67890',
        );
        return;
      }
      await sendText(
        chatId,
        `Hero updated (${next.length}): ${next.join(' → ')}`,
      );
      return;
    }

    if (cmdToken === '/trending' || text.startsWith('/trending ')) {
      await clearPendingPaymentEdit(userId);
      await clearPendingOrderDelivery(userId);
      const parts = text.trim().split(/\s+/);
      if (parts.length === 1) {
        const ids = await getTrendingProductIds();
        await sendText(
          chatId,
          [
            '🔥 Home trending — catalog product IDs:',
            ids.length ? ids.join(' → ') : '(none — uses default catalog relevance)',
            '',
            'Set up to 10 IDs: /trending 12345 67890',
            'Clear: /trending clear',
          ].join('\n'),
        );
        return;
      }
      if (parts[1].toLowerCase() === 'clear') {
        await setTrendingProductIds([]);
        await sendText(
          chatId,
          'Trending cleared. Strip will load the default relevance list from the catalog.',
        );
        return;
      }
      const next = await setTrendingProductIds(parts.slice(1));
      if (next.length === 0) {
        await sendText(
          chatId,
          'No valid numeric IDs. Send catalog product IDs, e.g. /trending 12345 67890',
        );
        return;
      }
      await sendText(
        chatId,
        `Trending updated (${next.length}): ${next.join(' → ')}`,
      );
      return;
    }

    if (cmdToken === '/coupon_off' || text.startsWith('/coupon_off ')) {
      await clearPendingPaymentEdit(userId);
      await clearPendingOrderDelivery(userId);
      const parts = text.split(/\s+/);
      if (parts.length < 2) {
        await sendText(chatId, 'Usage: /coupon_off CODE');
        return;
      }
      const code = normalizeCouponCode(parts.slice(1).join(' '));
      const updated = await setCouponActive(code, false);
      if (!updated) {
        await sendText(chatId, 'Coupon not found.');
        return;
      }
      await sendText(chatId, `Disabled: ${updated.code}`);
      return;
    }

    if (cmdToken === '/deliver' || text.startsWith('/deliver ')) {
      await clearPendingPaymentEdit(userId);
      await clearPendingOrderDelivery(userId);
      const [, second, ...rest] = text.trim().split(/\s+/);
      const orderId = (second ?? '').trim();
      const details = rest.join(' ').trim();
      if (!orderId || !details) {
        await sendText(chatId, 'Usage: /deliver ORDER_ID delivery details text');
        return;
      }
      const existing = await getOrder(orderId);
      if (!existing) {
        await sendText(chatId, 'Order not found.');
        return;
      }
      const perProductDetails = existing.items.map(() => details);
      const delivered = await markOrderDelivered(
        orderId,
        combinedDeliveryDetails(existing, perProductDetails),
        perProductDetails,
      );
      if (!delivered) {
        await sendText(chatId, 'Order not found.');
        return;
      }
      try {
        await sendOrderDeliveredEmail(delivered, delivered.deliveryDetails ?? details);
        await markOrderDeliveryNotified(delivered.id);
        await sendText(
          chatId,
          [
            `✅ Delivered & emailed: ${delivered.id}`,
            `Email: ${delivered.email}`,
            `Public URL: ${orderPublicUrl(delivered)}`,
          ].join('\n'),
          orderKeyboard(delivered, lang),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await sendText(
          chatId,
          [
            `Order marked completed, but email failed.`,
            `Order: ${delivered.id}`,
            `Error: ${msg}`,
            `Public URL: ${orderPublicUrl(delivered)}`,
          ].join('\n'),
          orderKeyboard(delivered, lang),
        );
      }
      return;
    }

    if (cmdToken === '/ticket' || text.startsWith('/ticket ')) {
      await clearPendingPaymentEdit(userId);
      await clearPendingOrderDelivery(userId);
      const [, ticketIdRaw] = text.trim().split(/\s+/);
      const ticketId = (ticketIdRaw ?? '').trim();
      if (!ticketId) {
        await sendText(chatId, 'Usage: /ticket TKT-YYYYMMDD-XXXXX');
        return;
      }
      const ticket = await getSupportTicket(ticketId);
      if (!ticket) {
        await sendText(chatId, `Ticket not found: ${ticketId}`);
        return;
      }
      const last = ticket.messages.slice(-8);
      const body = last
        .map((m) => {
          const who = m.from === 'agent' ? 'Agent' : 'Customer';
          const textPart = m.text ? m.text : '(media only)';
          const mediaPart = m.attachment?.url ? `\nMedia: ${m.attachment.url}` : '';
          return `[${new Date(m.createdAt).toISOString()}] ${who}: ${textPart}${mediaPart}`;
        })
        .join('\n\n');
      await sendText(chatId, [`Ticket: ${ticket.id}`, `Status: ${ticket.status}`, '', body].join('\n'));
      return;
    }

    if (cmdToken === '/reply' || text.startsWith('/reply ')) {
      await clearPendingPaymentEdit(userId);
      await clearPendingOrderDelivery(userId);
      const [, ticketIdRaw, ...rest] = text.trim().split(/\s+/);
      const ticketId = (ticketIdRaw ?? '').trim();
      const replyText = rest.join(' ').trim();
      if (!ticketId || !replyText) {
        await sendText(chatId, 'Usage: /reply TKT-YYYYMMDD-XXXXX your reply text');
        return;
      }
      const updated = await addSupportAgentReply(ticketId, replyText);
      if (!updated) {
        await sendText(chatId, `Ticket not found: ${ticketId}`);
        return;
      }
      await sendText(chatId, `Reply added to ${ticketId}.`);
      return;
    }

    if (text === '/cancel') {
      await clearPendingPaymentEdit(userId);
      await clearPendingOrderDelivery(userId);
      await sendText(chatId, lang === 'ar' ? 'تم الإلغاء.' : 'Cancelled.');
      return;
    }

    const pendingDelivery = await getPendingOrderDelivery(userId);
    if (pendingDelivery) {
      const details = text.trim();
      if (!details) {
        await sendText(chatId, 'Delivery details are empty. Send text or /cancel.');
        return;
      }
      const existing = await getOrder(pendingDelivery.orderId);
      if (!existing) {
        await clearPendingOrderDelivery(userId);
        await sendText(chatId, 'Order not found. Cancelled.');
        return;
      }
      const nextDetails = [...pendingDelivery.productDetails, details];
      const nextIndex = pendingDelivery.itemIndex + 1;
      if (nextIndex < existing.items.length) {
        await setPendingOrderDelivery(userId, existing.id, nextIndex, nextDetails);
        await sendText(
          chatId,
          [
            `Saved Product ${pendingDelivery.itemIndex + 1}/${existing.items.length}.`,
            `Now send details for Product ${nextIndex + 1}: ${existing.items[nextIndex]?.title ?? ''}`,
            'Tip: use /cancel to abort.',
          ].join('\n'),
        );
        return;
      }

      const delivered = await markOrderDelivered(
        pendingDelivery.orderId,
        combinedDeliveryDetails(existing, nextDetails),
        nextDetails,
      );
      if (!delivered) {
        await clearPendingOrderDelivery(userId);
        await sendText(chatId, 'Order not found. Cancelled.');
        return;
      }
      await clearPendingOrderDelivery(userId);
      try {
        await sendOrderDeliveredEmail(
          delivered,
          delivered.deliveryDetails ?? nextDetails.join('\n\n'),
        );
        await markOrderDeliveryNotified(delivered.id);
        await sendText(
          chatId,
          [
            `✅ Delivered & emailed: ${delivered.id}`,
            `Email: ${delivered.email}`,
            `Public URL: ${orderPublicUrl(delivered)}`,
          ].join('\n'),
          orderKeyboard(delivered, lang),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await sendText(
          chatId,
          [
            `Order marked completed, but email failed.`,
            `Order: ${delivered.id}`,
            `Error: ${msg}`,
            `Public URL: ${orderPublicUrl(delivered)}`,
          ].join('\n'),
          orderKeyboard(delivered, lang),
        );
      }
      return;
    }

    const pending = await getPendingPaymentEdit(userId);
    if (pending) {
      const method = (await listPaymentMethods()).find((m) => m.id === pending.methodId);
      if (!method) {
        await clearPendingPaymentEdit(userId);
        await sendText(chatId, 'Method not found. Cancelled.');
        return;
      }
      try {
        const value = normalizeFieldValue(pending.field, text);
        const patch: Partial<Pick<PaymentMethod, 'name' | 'icon' | 'account' | 'barcodeUrl'>> = {};
        if (pending.field === 'name') patch.name = value || method.name;
        if (pending.field === 'account') patch.account = value || method.account;
        if (pending.field === 'icon') patch.icon = value || method.icon;
        if (pending.field === 'barcodeUrl') {
          patch.barcodeUrl = value === '' ? undefined : value;
        }
        await updatePaymentMethod(method.id, patch);
        await clearPendingPaymentEdit(userId);
        const updated = (await listPaymentMethods()).find((m) => m.id === method.id);
        await sendText(
          chatId,
          `Saved ${pending.field} for ${method.name}.${updated ? `\n\n${formatMethodEditText(updated, lang)}` : ''}`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await sendText(chatId, `Error: ${msg}\nTry again or /cancel.`);
      }
      return;
    }

    await sendText(
      chatId,
      'Unknown command. Use /orders, /payments, /tax, /calc, /gencoupon, /coupons, /hero, /trending, /hero_ttl, /catalog',
    );
    return;
  }

  const cb = update.callback_query;
  if (!cb || !cb.data || !cb.message) return;
  if (!isAllowedAdmin(cb.from.id)) {
    await answerCallbackQuery(cb.id, 'Unauthorized');
    return;
  }

  const chatId = cb.message.chat.id;
  const userId = cb.from.id;
  const messageId = cb.message.message_id;
  const lang = await getTelegramUserLang(userId);

  if (cb.data.startsWith('lang:set:')) {
    const code = cb.data.slice('lang:set:'.length);
    const nextLang: TelegramLang = code === 'ar' ? 'ar' : 'en';
    await setTelegramUserLang(userId, nextLang);
    await answerCallbackQuery(cb.id, nextLang === 'ar' ? 'تم اختيار العربية' : 'English selected');
    await sendText(chatId, startHelpText(nextLang));
    return;
  }

  if (cb.data === 'payment:list') {
    await sendPaymentMethods(chatId, lang);
    await answerCallbackQuery(cb.id, lang === 'ar' ? 'تم فتح طرق الدفع' : 'Opened payment methods');
    return;
  }
  if (cb.data === 'order:list') {
    await sendRecentOrders(chatId, lang);
    await answerCallbackQuery(cb.id, lang === 'ar' ? 'تم تحديث الطلبات' : 'Orders refreshed');
    return;
  }

  if (cb.data === 'payment:back:list') {
    await clearPendingPaymentEdit(userId);
    if (messageId != null) {
      try {
        await editPaymentMethodsMessage(chatId, messageId, lang);
      } catch {
        await sendPaymentMethods(chatId, lang);
      }
    } else {
      await sendPaymentMethods(chatId, lang);
    }
    await answerCallbackQuery(cb.id, lang === 'ar' ? 'رجوع' : 'Back');
    return;
  }

  if (cb.data === 'payment:cancel:pending') {
    await clearPendingPaymentEdit(userId);
    if (messageId != null) {
      try {
        await editPaymentMethodsMessage(chatId, messageId, lang);
      } catch {
        await sendPaymentMethods(chatId, lang);
      }
    }
    await answerCallbackQuery(cb.id, lang === 'ar' ? 'تم الإلغاء' : 'Cancelled');
    return;
  }

  if (cb.data.startsWith('payment:editmenu:')) {
    const methodId = cb.data.slice('payment:editmenu:'.length);
    const methods = await listPaymentMethods();
    const method = methods.find((m) => m.id === methodId);
    if (!method || messageId == null) {
      await answerCallbackQuery(cb.id, lang === 'ar' ? 'غير موجود' : 'Not found');
      return;
    }
    await clearPendingPaymentEdit(userId);
    try {
      await editPaymentEditMenuMessage(chatId, messageId, method, lang);
    } catch {
      await sendText(chatId, formatMethodEditText(method, lang), editMenuKeyboard(method.id, lang));
    }
    await answerCallbackQuery(cb.id, lang === 'ar' ? 'تعديل' : 'Edit');
    return;
  }

  if (cb.data.startsWith('payment:field:')) {
    const rest = cb.data.slice('payment:field:'.length);
    const lastColon = rest.lastIndexOf(':');
    if (lastColon <= 0) {
      await answerCallbackQuery(cb.id, lang === 'ar' ? 'بيانات غير صحيحة' : 'Bad data');
      return;
    }
    const methodId = rest.slice(0, lastColon);
    const code = rest.slice(lastColon + 1) as keyof typeof FIELD_CODE;
    const field = FIELD_CODE[code];
    if (!field) {
      await answerCallbackQuery(cb.id, lang === 'ar' ? 'حقل غير صحيح' : 'Bad field');
      return;
    }
    const methods = await listPaymentMethods();
    const method = methods.find((m) => m.id === methodId);
    if (!method || messageId == null) {
      await answerCallbackQuery(cb.id, lang === 'ar' ? 'غير موجود' : 'Not found');
      return;
    }
    await setPendingPaymentEdit(userId, methodId, field);
    try {
      await editPaymentPromptMessage(chatId, messageId, method, field);
    } catch {
      await sendText(chatId, `Reply with new ${field} for ${method.name}`);
    }
    await answerCallbackQuery(cb.id, lang === 'ar' ? `أرسل ${field}` : `Send ${field}`);
    return;
  }

  if (cb.data.startsWith('payment:toggle:')) {
    const id = cb.data.split(':')[2];
    const methods = await listPaymentMethods();
    const updated = methods.map((method) => (method.id === id ? { ...method, enabled: !method.enabled } : method));
    await savePaymentMethods(updated);
    await clearPendingPaymentEdit(userId);
    if (messageId != null) {
      try {
        await editPaymentMethodsMessage(chatId, messageId, lang);
      } catch {
        await sendPaymentMethods(chatId, lang);
      }
    } else {
      await sendPaymentMethods(chatId, lang);
    }
    await answerCallbackQuery(cb.id, lang === 'ar' ? 'تم التحديث' : 'Updated');
    return;
  }
  if (cb.data.startsWith('order:set:')) {
    const [, , orderId, statusRaw] = cb.data.split(':');
    const status = statusRaw as OrderStatus;
    if (status === 'completed') {
      const existing = await getOrder(orderId);
      if (!existing) {
        await answerCallbackQuery(cb.id, lang === 'ar' ? 'الطلب غير موجود' : 'Order not found');
        return;
      }
      await setPendingOrderDelivery(userId, orderId, 0, []);
      await answerCallbackQuery(
        cb.id,
        lang === 'ar' ? `أرسل تفاصيل التسليم للطلب ${orderId}` : `Send delivery details for ${orderId}`,
      );
      await sendText(
        chatId,
        [
          lang === 'ar' ? `📝 موافقة ${orderId}` : `📝 Approve ${orderId}`,
          lang === 'ar'
            ? `أرسل الآن تفاصيل المنتج 1/${existing.items.length}: ${existing.items[0]?.title ?? ''}`
            : `Now send details for Product 1/${existing.items.length}: ${existing.items[0]?.title ?? ''}`,
          lang === 'ar'
            ? 'سأطلب منك تفاصيل كل منتج حتى انتهاء جميع المنتجات.'
            : 'I will ask again for each next product if this order has multiple items.',
          lang === 'ar' ? 'ملاحظة: استخدم /cancel للإلغاء.' : 'Tip: use /cancel to abort.',
        ].join('\n'),
      );
      return;
    }
    const order = await updateOrderStatus(orderId, status);
    if (!order) {
      await answerCallbackQuery(cb.id, lang === 'ar' ? 'الطلب غير موجود' : 'Order not found');
      return;
    }
    await answerCallbackQuery(
      cb.id,
      lang === 'ar'
        ? `الطلب ${order.id} -> ${statusLabelByLang(status, lang)}`
        : `Order ${order.id} -> ${statusLabel(status)}`,
    );
    const fresh = await getOrder(order.id);
    if (fresh) {
      await sendText(
        chatId,
        lang === 'ar'
          ? `تم التحديث: ${fresh.id} حالته الآن ${statusLabelByLang(fresh.status, lang)}`
          : `Updated: ${fresh.id} is now ${statusLabel(fresh.status)}`,
        orderKeyboard(fresh, lang),
      );
    }
  }
}
