import { z } from "zod";
import { ApiError, route, unprocessable } from "@/lib/server/api";
import { renderEmail, sendEmail, verifySmtp } from "@/lib/server/notify/email";
import { sendTelegramMessage, tgEscape } from "@/lib/server/notify/telegram";
import { sendWhatsApp } from "@/lib/server/notify/whatsapp";
import { getIntegrations, getSettings } from "@/lib/server/settings";

export const POST = route(
  {
    auth: "admin",
    body: z.object({ channel: z.enum(["telegram", "whatsapp", "email"]) }),
    rateLimit: [{ name: "integtest", limit: 12, windowSec: 600, by: "admin" }],
  },
  async ({ admin, body }) => {
    const integ = await getIntegrations();
    const s = await getSettings();
    const brand = s.business.name;
    try {
      if (body.channel === "telegram") {
        if (!integ.telegram.configured) throw unprocessable("Add the bot token and your chat ID first.");
        await sendTelegramMessage(
          integ.telegram.botToken!,
          integ.telegram.chatId!,
          `✅ <b>${tgEscape(brand)}</b> is connected. New ride requests will appear here.`,
        );
      } else if (body.channel === "whatsapp") {
        if (!integ.whatsapp.configured || !integ.whatsapp.adminNumber) throw unprocessable("Complete the WhatsApp settings first.");
        await sendWhatsApp(integ.whatsapp, integ.whatsapp.adminNumber, `✅ ${brand} is connected. New ride requests will be sent here.`);
      } else {
        if (!integ.smtp.configured) throw unprocessable("Complete the SMTP settings first.");
        await verifySmtp(integ.smtp);
        const to = s.notifications.adminEmail || admin!.email;
        const mail = renderEmail({
          brand,
          preheader: "Email delivery is working.",
          title: "Email is configured correctly",
          blocks: [{ type: "p", text: `This is a test message from ${brand}. Customer verification codes and ride updates will be delivered from this address.` }],
        });
        await sendEmail(integ.smtp, { to, subject: `${brand}: test email`, ...mail }, brand);
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(502, `Test failed: ${(err as Error).message}`.slice(0, 300), "integration_failed");
    }
    return { ok: true };
  },
);
