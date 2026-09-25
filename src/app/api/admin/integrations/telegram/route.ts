import { z } from "zod";
import { ApiError, route, unprocessable } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { randomToken } from "@/lib/server/crypto";
import { absoluteUrl, env } from "@/lib/server/env";
import { sealSecret } from "@/lib/server/keys";
import {
  deleteTelegramWebhook,
  detectChatId,
  getBotInfo,
  setBotCommands,
  setTelegramWebhook,
} from "@/lib/server/notify/telegram";
import { getIntegrations, getSetting, saveSetting } from "@/lib/server/settings";

export const POST = route(
  {
    auth: "admin",
    body: z.object({ action: z.enum(["detect_chat", "enable_webhook", "disable_webhook", "bot_info"]) }),
    rateLimit: [{ name: "tgadmin", limit: 20, windowSec: 600, by: "admin" }],
  },
  async ({ admin, body, ip, userAgent }) => {
    const integ = await getIntegrations();
    const token = integ.telegram.botToken;
    if (!token) throw unprocessable("Save your bot token first.");
    try {
      if (body.action === "bot_info") return { bot: await getBotInfo(token) };
      if (body.action === "detect_chat") {
        if (integ.telegram.webhookEnabled) await deleteTelegramWebhook(token);
        const found = await detectChatId(token);
        if (!found) throw unprocessable("No messages found. Open your bot in Telegram, press Start, then try again.");
        const cur = await getSetting("integrations");
        await saveSetting("integrations", { ...cur, telegram: { ...cur.telegram, chatId: found.chatId, webhookEnabled: false } }, admin!.id);
        return { chatId: found.chatId, name: found.name };
      }
      if (body.action === "enable_webhook") {
        const url = absoluteUrl("/api/webhooks/telegram");
        if (!url.startsWith("https://")) throw unprocessable("Telegram webhooks need a public HTTPS URL (set APP_URL).");
        const cur = await getSetting("integrations");
        const secret = env().TELEGRAM_WEBHOOK_SECRET ?? randomToken(32).replace(/[^A-Za-z0-9_-]/g, "");
        await setTelegramWebhook(token, url, secret);
        await setBotCommands(token).catch(() => undefined);
        await saveSetting(
          "integrations",
          {
            ...cur,
            telegram: {
              ...cur.telegram,
              webhookEnabled: true,
              webhookSecretEnc: env().TELEGRAM_WEBHOOK_SECRET ? cur.telegram.webhookSecretEnc : sealSecret(secret),
            },
          },
          admin!.id,
        );
        await audit({ actorType: "ADMIN", actorId: admin!.id, action: "telegram.webhook_enable", ip, userAgent });
        return { webhookEnabled: true };
      }
      await deleteTelegramWebhook(token);
      const cur = await getSetting("integrations");
      await saveSetting("integrations", { ...cur, telegram: { ...cur.telegram, webhookEnabled: false } }, admin!.id);
      await audit({ actorType: "ADMIN", actorId: admin!.id, action: "telegram.webhook_disable", ip, userAgent });
      return { webhookEnabled: false };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(502, (err as Error).message.slice(0, 300), "telegram_failed");
    }
  },
);
