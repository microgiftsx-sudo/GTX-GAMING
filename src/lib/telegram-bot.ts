import {
  getOrder,
  listOrders,
  listPaymentMethods,
  OrderRecord,
  OrderStatus,
  PaymentMethod,
  savePaymentMethods,
  updatePaymentMethod,
  updateOrderStatus,
} from '@/lib/orders';
import {
  clearPendingPaymentEdit,
  getPendingPaymentEdit,
  setPendingPaymentEdit,
  type PaymentEditField,
} from '@/lib/payment-edit-state';
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

function orderKeyboard(order: OrderRecord) {
  const productButtons = order.items.slice(0, 2).map((item, idx) => ({
    text: `Kinguin ${idx + 1}`,
    url: item.kinguinUrl,
  }));

  const rows: { text: string; callback_data?: string; url?: string }[][] = [];
  if (productButtons.length > 0) {
    rows.push(productButtons);
  }
  rows.push(
    [
      { text: 'Approve', callback_data: `order:set:${order.id}:completed` },
      { text: 'Processing', callback_data: `order:set:${order.id}:processing` },
    ],
    [
      { text: 'Hold', callback_data: `order:set:${order.id}:on_hold` },
      { text: 'Refund', callback_data: `order:set:${order.id}:refunded` },
    ],
    [{ text: 'Cancel', callback_data: `order:set:${order.id}:cancelled` }],
    [{ text: 'Payment Methods', callback_data: 'payment:list' }],
  );

  return { inline_keyboard: rows };
}

function orderMessage(order: OrderRecord) {
  const lines = [
    `🧾 New Order: ${order.id}`,
    `Status: ${statusLabel(order.status)}`,
    `Email: ${order.email}`,
    `Payment: ${order.paymentMethodName}`,
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
      `Subtotal (before tax): ${order.subtotalBeforeTax.toLocaleString('en-US')} IQD`,
      `Tax (${order.taxRatePercent}%): ${(order.taxAmount ?? 0).toLocaleString('en-US')} IQD`,
      `Total after tax: ${afterTaxBeforeCoupon.toLocaleString('en-US')} IQD`,
    );
    if (hasCoupon && order.couponCode) {
      lines.push(
        `Coupon ${order.couponCode} (${order.couponPercentOff ?? '?'}%): −${discount.toLocaleString('en-US')} IQD`,
        `Amount due (IQD): ${order.subtotal.toLocaleString('en-US')}`,
      );
    }
  } else if (hasCoupon && order.couponCode) {
    lines.push(
      `Subtotal (after tax): ${afterTaxBeforeCoupon.toLocaleString('en-US')} IQD`,
      `Coupon ${order.couponCode} (${order.couponPercentOff ?? '?'}%): −${discount.toLocaleString('en-US')} IQD`,
      `Amount due (IQD): ${order.subtotal.toLocaleString('en-US')}`,
    );
  } else {
    lines.push(`Subtotal (IQD): ${order.subtotal.toLocaleString('en-US')}`);
  }
  lines.push(
    `Created: ${order.createdAt}`,
    '',
    'Items (unit list / IQD):',
    ...order.items.map(
      (item) => `• ${item.title} x${item.quantity} (${item.price.toLocaleString('en-US')} IQD)`,
    ),
  );
  return lines.join('\n');
}

const TELEGRAM_CAPTION_MAX = 1024;

function orderCaptionForPhoto(order: OrderRecord) {
  const text = orderMessage(order);
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

const PAYMENT_METHODS_TEXT = 'Payment methods control:';

const FIELD_CODE: Record<'n' | 'a' | 'b' | 'i', PaymentEditField> = {
  n: 'name',
  a: 'account',
  b: 'barcodeUrl',
  i: 'icon',
};

function formatMethodEditText(method: PaymentMethod) {
  const barcode = method.barcodeUrl?.trim() ? method.barcodeUrl : '(not set)';
  return [
    `✏️ Edit: ${method.name}`,
    `ID: ${method.id}`,
    `Account: ${method.account}`,
    `Barcode: ${barcode}`,
    `Icon: ${method.icon}`,
    '',
    'Choose a field, then send the new value in the next message.',
  ].join('\n');
}

function editMenuKeyboard(methodId: string) {
  return {
    inline_keyboard: [
      [
        { text: 'Name', callback_data: `payment:field:${methodId}:n` },
        { text: 'Account', callback_data: `payment:field:${methodId}:a` },
      ],
      [
        { text: 'Barcode URL', callback_data: `payment:field:${methodId}:b` },
        { text: 'Icon URL', callback_data: `payment:field:${methodId}:i` },
      ],
      [
        { text: '← Back', callback_data: 'payment:back:list' },
        { text: 'Cancel input', callback_data: 'payment:cancel:pending' },
      ],
    ],
  };
}

async function buildPaymentMethodsReplyMarkup() {
  const methods = await listPaymentMethods();
  const keyboard = methods.map((method) => [
    {
      text: `${method.enabled ? '✅' : '❌'} ${method.name}`,
      callback_data: `payment:toggle:${method.id}`,
    },
    { text: '✏️', callback_data: `payment:editmenu:${method.id}` },
  ]);
  keyboard.push([{ text: 'Refresh Orders', callback_data: 'order:list' }]);
  return { inline_keyboard: keyboard };
}

async function sendPaymentMethods(chatId: number) {
  const reply_markup = await buildPaymentMethodsReplyMarkup();
  await sendText(chatId, PAYMENT_METHODS_TEXT, reply_markup);
}

async function editPaymentMethodsMessage(chatId: number, messageId: number) {
  const reply_markup = await buildPaymentMethodsReplyMarkup();
  await callTelegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: PAYMENT_METHODS_TEXT,
    reply_markup,
  });
}

async function editPaymentEditMenuMessage(chatId: number, messageId: number, method: PaymentMethod) {
  await callTelegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: formatMethodEditText(method),
    reply_markup: editMenuKeyboard(method.id),
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

async function sendRecentOrders(chatId: number) {
  const orders = await listOrders();
  if (orders.length === 0) {
    await sendText(chatId, 'No orders yet.');
    return;
  }
  const sample = orders.slice(0, 5);
  await sendText(
    chatId,
    sample
      .map((order) => `${order.id} | ${statusLabel(order.status)} | ${order.subtotal.toLocaleString('en-US')} IQD`)
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
  const kb = orderKeyboard(order);
  const caption = orderCaptionForPhoto(order);
  const receipt = order.receiptUrl?.trim() ?? '';
  const canUsePhoto = /^https?:\/\//i.test(receipt);

  if (canUsePhoto) {
    try {
      await sendOrderPhotoWithCaption(DEFAULT_CHAT_ID, receipt, caption, kb);
      return;
    } catch {
      await sendText(
        DEFAULT_CHAT_ID,
        `${orderMessage(order)}\n\nProof: ${receipt}`,
        kb,
      );
      return;
    }
  }

  await sendText(DEFAULT_CHAT_ID, orderMessage(order), kb);
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  if (!hasBotConfig()) return;

  if (update.message?.text && update.message.from?.id) {
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    if (!isAllowedAdmin(userId)) {
      await sendText(chatId, 'Unauthorized.');
      return;
    }
    const text = update.message.text.trim();

    if (text === '/start') {
      await clearPendingPaymentEdit(userId);
      await sendText(
        chatId,
        [
          'GTX Bot ready.',
          'Commands:',
          '/orders — recent orders',
          '/payments — toggle methods; tap ✏️ to edit name, account, barcode URL, icon',
          '/tax — show VAT %; set: /tax 5',
          '/calc AMOUNT — tax calculator (IQD); optional: /calc 50000 10',
          '/gencoupon PERCENT [maxUses] [days] — create discount code',
          '/coupons — list coupons',
          '/coupon_off CODE — disable a coupon',
          '/hero — hero carousel Kinguin IDs; set: /hero 123 456; clear: /hero clear',
          `/hero_ttl — cache window (default ${DEFAULT_HERO_CACHE_TTL_SECONDS / 3600}h); set: /hero_ttl 6h or /hero_ttl 3600`,
        ].join('\n'),
      );
      return;
    }
    if (text === '/orders') {
      await clearPendingPaymentEdit(userId);
      await sendRecentOrders(chatId);
      return;
    }
    if (text === '/payments') {
      await clearPendingPaymentEdit(userId);
      await sendPaymentMethods(chatId);
      return;
    }

    const cmdToken = text.split(/\s+/)[0]?.split('@')[0] ?? '';
    if (cmdToken === '/tax' || text.startsWith('/tax ')) {
      await clearPendingPaymentEdit(userId);
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
      const parts = text.trim().split(/\s+/);
      if (parts.length === 1) {
        const ids = await getHeroProductIds();
        const ttlSec = await getHeroCacheTtlSeconds();
        await sendText(
          chatId,
          [
            '🖼 Home hero — Kinguin product IDs:',
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
          'No valid numeric IDs. Send Kinguin product IDs, e.g. /hero 12345 67890',
        );
        return;
      }
      await sendText(
        chatId,
        `Hero updated (${next.length}): ${next.join(' → ')}`,
      );
      return;
    }

    if (cmdToken === '/coupon_off' || text.startsWith('/coupon_off ')) {
      await clearPendingPaymentEdit(userId);
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

    if (text === '/cancel') {
      await clearPendingPaymentEdit(userId);
      await sendText(chatId, 'Cancelled.');
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
          `Saved ${pending.field} for ${method.name}.${updated ? `\n\n${formatMethodEditText(updated)}` : ''}`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await sendText(chatId, `Error: ${msg}\nTry again or /cancel.`);
      }
      return;
    }

    await sendText(
      chatId,
      'Unknown command. Use /orders, /payments, /tax, /calc, /gencoupon, /coupons, /hero, /hero_ttl',
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

  if (cb.data === 'payment:list') {
    await sendPaymentMethods(chatId);
    await answerCallbackQuery(cb.id, 'Opened payment methods');
    return;
  }
  if (cb.data === 'order:list') {
    await sendRecentOrders(chatId);
    await answerCallbackQuery(cb.id, 'Orders refreshed');
    return;
  }

  if (cb.data === 'payment:back:list') {
    await clearPendingPaymentEdit(userId);
    if (messageId != null) {
      try {
        await editPaymentMethodsMessage(chatId, messageId);
      } catch {
        await sendPaymentMethods(chatId);
      }
    } else {
      await sendPaymentMethods(chatId);
    }
    await answerCallbackQuery(cb.id, 'Back');
    return;
  }

  if (cb.data === 'payment:cancel:pending') {
    await clearPendingPaymentEdit(userId);
    if (messageId != null) {
      try {
        await editPaymentMethodsMessage(chatId, messageId);
      } catch {
        await sendPaymentMethods(chatId);
      }
    }
    await answerCallbackQuery(cb.id, 'Cancelled');
    return;
  }

  if (cb.data.startsWith('payment:editmenu:')) {
    const methodId = cb.data.slice('payment:editmenu:'.length);
    const methods = await listPaymentMethods();
    const method = methods.find((m) => m.id === methodId);
    if (!method || messageId == null) {
      await answerCallbackQuery(cb.id, 'Not found');
      return;
    }
    await clearPendingPaymentEdit(userId);
    try {
      await editPaymentEditMenuMessage(chatId, messageId, method);
    } catch {
      await sendText(chatId, formatMethodEditText(method), editMenuKeyboard(method.id));
    }
    await answerCallbackQuery(cb.id, 'Edit');
    return;
  }

  if (cb.data.startsWith('payment:field:')) {
    const rest = cb.data.slice('payment:field:'.length);
    const lastColon = rest.lastIndexOf(':');
    if (lastColon <= 0) {
      await answerCallbackQuery(cb.id, 'Bad data');
      return;
    }
    const methodId = rest.slice(0, lastColon);
    const code = rest.slice(lastColon + 1) as keyof typeof FIELD_CODE;
    const field = FIELD_CODE[code];
    if (!field) {
      await answerCallbackQuery(cb.id, 'Bad field');
      return;
    }
    const methods = await listPaymentMethods();
    const method = methods.find((m) => m.id === methodId);
    if (!method || messageId == null) {
      await answerCallbackQuery(cb.id, 'Not found');
      return;
    }
    await setPendingPaymentEdit(userId, methodId, field);
    try {
      await editPaymentPromptMessage(chatId, messageId, method, field);
    } catch {
      await sendText(chatId, `Reply with new ${field} for ${method.name}`);
    }
    await answerCallbackQuery(cb.id, `Send ${field}`);
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
        await editPaymentMethodsMessage(chatId, messageId);
      } catch {
        await sendPaymentMethods(chatId);
      }
    } else {
      await sendPaymentMethods(chatId);
    }
    await answerCallbackQuery(cb.id, 'Updated');
    return;
  }
  if (cb.data.startsWith('order:set:')) {
    const [, , orderId, statusRaw] = cb.data.split(':');
    const status = statusRaw as OrderStatus;
    const order = await updateOrderStatus(orderId, status);
    if (!order) {
      await answerCallbackQuery(cb.id, 'Order not found');
      return;
    }
    await answerCallbackQuery(cb.id, `Order ${order.id} -> ${statusLabel(status)}`);
    const fresh = await getOrder(order.id);
    if (fresh) {
      await sendText(chatId, `Updated: ${fresh.id} is now ${statusLabel(fresh.status)}`, orderKeyboard(fresh));
    }
  }
}
