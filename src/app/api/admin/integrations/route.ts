import { z } from "zod";
import { route } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { getIntegrationsForAdmin, getSetting, saveSetting, updateSecret } from "@/lib/server/settings";
import { WHATSAPP_PROVIDERS } from "@/lib/settings-schema";

const secret = z.string().max(512).optional();
const plain = (max: number) => z.string().trim().max(max).optional();

export const GET = route({ auth: "admin" }, async () => getIntegrationsForAdmin());

/** Secrets are write-only: omit a field to keep it, send "" to clear it. */
export const PUT = route(
  {
    auth: "admin",
    body: z.object({
      telegram: z.object({ botToken: secret, chatId: z.string().trim().regex(/^-?\d{0,20}$/).optional() }).optional(),
      whatsapp: z
        .object({
          provider: z.enum(WHATSAPP_PROVIDERS).optional(),
          adminNumber: z.string().trim().regex(/^\+?\d{0,15}$/).optional(),
          metaToken: secret,
          metaPhoneNumberId: z.string().trim().regex(/^\d{0,30}$/).optional(),
          metaTemplate: z.string().trim().regex(/^[a-z0-9_]{0,60}$/).optional(),
          metaTemplateLang: z.string().trim().regex(/^[a-zA-Z_]{0,10}$/).optional(),
          metaApiVersion: z.string().trim().regex(/^v\d{1,2}\.\d$/).optional(),
          twilioSid: z.string().trim().regex(/^(AC[a-f0-9]{32})?$/).optional(),
          twilioToken: secret,
          twilioFrom: z.string().trim().regex(/^(whatsapp:)?\+?\d{0,15}$/).optional(),
          callmebotApiKey: secret,
        })
        .optional(),
      smtp: z
        .object({
          host: z.string().trim().regex(/^[a-zA-Z0-9.-]{0,120}$/).optional(),
          port: z.number().int().min(1).max(65535).optional(),
          secure: z.boolean().optional(),
          user: plain(160),
          pass: secret,
          from: plain(160),
        })
        .optional(),
    }),
  },
  async ({ admin, body, ip, userAgent }) => {
    const cur = await getSetting("integrations");
    const next = structuredClone(cur);
    if (body.telegram) {
      next.telegram.botTokenEnc = updateSecret(cur.telegram.botTokenEnc, body.telegram.botToken);
      if (body.telegram.chatId !== undefined) next.telegram.chatId = body.telegram.chatId;
      if (body.telegram.botToken !== undefined) next.telegram.webhookEnabled = false;
    }
    if (body.whatsapp) {
      const w = body.whatsapp;
      const n = next.whatsapp;
      if (w.provider) n.provider = w.provider;
      if (w.adminNumber !== undefined) n.adminNumber = w.adminNumber;
      if (w.metaPhoneNumberId !== undefined) n.metaPhoneNumberId = w.metaPhoneNumberId;
      if (w.metaTemplate !== undefined) n.metaTemplate = w.metaTemplate;
      if (w.metaTemplateLang !== undefined) n.metaTemplateLang = w.metaTemplateLang || "en";
      if (w.metaApiVersion !== undefined) n.metaApiVersion = w.metaApiVersion || "v23.0";
      if (w.twilioSid !== undefined) n.twilioSid = w.twilioSid;
      if (w.twilioFrom !== undefined) n.twilioFrom = w.twilioFrom;
      n.metaTokenEnc = updateSecret(cur.whatsapp.metaTokenEnc, w.metaToken);
      n.twilioTokenEnc = updateSecret(cur.whatsapp.twilioTokenEnc, w.twilioToken);
      n.callmebotApiKeyEnc = updateSecret(cur.whatsapp.callmebotApiKeyEnc, w.callmebotApiKey);
    }
    if (body.smtp) {
      const m = body.smtp;
      if (m.host !== undefined) next.smtp.host = m.host;
      if (m.port !== undefined) next.smtp.port = m.port;
      if (m.secure !== undefined) next.smtp.secure = m.secure;
      if (m.user !== undefined) next.smtp.user = m.user;
      if (m.from !== undefined) next.smtp.from = m.from;
      next.smtp.passEnc = updateSecret(cur.smtp.passEnc, m.pass);
    }
    await saveSetting("integrations", next, admin!.id);
    await audit({
      actorType: "ADMIN",
      actorId: admin!.id,
      action: "settings.update.integrations",
      meta: { sections: Object.keys(body) },
      ip,
      userAgent,
    });
    return getIntegrationsForAdmin();
  },
);
