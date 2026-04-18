import { getOrder, listOrders, listPaymentMethods, OrderRecord, OrderStatus, savePaymentMethods, updateOrderStatus } from '@/lib/orders';

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
    message?: { chat: { id: number } };
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

async function sendPaymentMethods(chatId: number) {
  const methods = await listPaymentMethods();
  const keyboard = methods.map((method) => [
    {
      text: `${method.enabled ? '✅' : '❌'} ${method.name}`,
      callback_data: `payment:toggle:${method.id}`,
    },
  ]);
  keyboard.push([{ text: 'Refresh Orders', callback_data: 'order:list' }]);
  await sendText(chatId, 'Payment methods control:', { inline_keyboard: keyboard });
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
      await sendText(chatId, 'GTX Bot ready.\nCommands:\n/orders\n/payments');
      return;
    }
    if (text === '/orders') {
      await sendRecentOrders(chatId);
      return;
    }
    if (text === '/payments') {
      await sendPaymentMethods(chatId);
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
  if (cb.data.startsWith('payment:toggle:')) {
    const id = cb.data.split(':')[2];
    const methods = await listPaymentMethods();
    const updated = methods.map((method) => (method.id === id ? { ...method, enabled: !method.enabled } : method));
    await savePaymentMethods(updated);
    await answerCallbackQuery(cb.id, 'Payment method updated');
    await sendPaymentMethods(chatId);
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

