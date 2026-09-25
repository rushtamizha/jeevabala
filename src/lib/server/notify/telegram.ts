import "server-only";

const API = "https://api.telegram.org";

export type TgButton = { text: string; callback_data?: string; url?: string };

type TgResponse<T> = { ok: boolean; result?: T; description?: string; error_code?: number };

async function call<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  if (!/^\d{5,16}:[A-Za-z0-9_-]{30,64}$/.test(token)) throw new Error("Telegram bot token looks invalid");
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }))) as TgResponse<T>;
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description ?? "unknown error"}`);
  return data.result as T;
}

/** Escape text for Telegram `parse_mode: HTML`. */
export function tgEscape(s: string | number | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  buttons?: TgButton[][],
): Promise<{ message_id: number }> {
  return call(token, "sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4000),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: buttons?.length ? { inline_keyboard: buttons } : undefined,
  });
}

export async function editTelegramMessage(
  token: string,
  chatId: string | number,
  messageId: number,
  text: string,
  buttons?: TgButton[][],
) {
  return call(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: text.slice(0, 4000),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: buttons ?? [] },
  });
}

export async function answerCallback(token: string, callbackId: string, text: string, alert = false) {
  return call(token, "answerCallbackQuery", { callback_query_id: callbackId, text: text.slice(0, 190), show_alert: alert });
}

export async function getBotInfo(token: string) {
  return call<{ id: number; username: string; first_name: string }>(token, "getMe");
}

export async function setTelegramWebhook(token: string, url: string, secret: string) {
  return call<boolean>(token, "setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
    max_connections: 5,
  });
}

export async function deleteTelegramWebhook(token: string) {
  return call<boolean>(token, "deleteWebhook", { drop_pending_updates: false });
}

export async function setBotCommands(token: string) {
  return call<boolean>(token, "setMyCommands", {
    commands: [
      { command: "pending", description: "Ride requests awaiting your response" },
      { command: "today", description: "Today's schedule" },
      { command: "stats", description: "Earnings snapshot" },
      { command: "help", description: "What this bot can do" },
    ],
  });
}

/** Find the most recent private chat that messaged the bot (setup helper; requires no webhook). */
export async function detectChatId(token: string): Promise<{ chatId: string; name: string } | null> {
  const updates = await call<
    { message?: { chat: { id: number; type: string; first_name?: string; username?: string; title?: string } } }[]
  >(token, "getUpdates", { limit: 20, allowed_updates: ["message"] });
  for (let i = updates.length - 1; i >= 0; i--) {
    const chat = updates[i].message?.chat;
    if (chat) return { chatId: String(chat.id), name: chat.first_name ?? chat.username ?? chat.title ?? "chat" };
  }
  return null;
}
