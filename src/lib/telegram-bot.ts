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

  return {
    inline_keyboard: [
      productButtons,
      [{ text: 'Proof Image', url: order.receiptUrl }],
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
    ],
  };
}

function orderMessage(order: OrderRecord) {
  const lines = [
    `🧾 New Order: ${order.id}`,
    `Status: ${statusLabel(order.status)}`,
    `Email: ${order.email}`,
    `Payment: ${order.paymentMethodName}`,
    `Subtotal (IQD): ${order.subtotal.toLocaleString('en-US')}`,
    `Created: ${order.createdAt}`,
    '',
    'Items:',
    ...order.items.map((item) => `• ${item.title} x${item.quantity} (${item.price.toLocaleString('en-US')} IQD)`),
  ];
  return lines.join('\n');
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
  await sendText(DEFAULT_CHAT_ID, orderMessage(order), orderKeyboard(order));
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
        'GTX Bot ready.\nCommands:\n/orders — recent orders\n/payments — toggle methods; tap ✏️ to edit name, account, barcode URL, icon',
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

    await sendText(chatId, 'Unknown command. Use /orders or /payments');
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
