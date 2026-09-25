import "server-only";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/db";
import { settings as settingsTable } from "@/db/schema";
import {
  SETTINGS_SCHEMAS,
  type IntegrationsStored,
  type SettingsKey,
  type SettingsMap,
} from "@/lib/settings-schema";
import { env } from "./env";
import { maskSecret, openSecret, sealSecret } from "./keys";

const TTL_MS = 15_000;
let memo: { value: SettingsMap; expires: number } | null = null;
let inflight: Promise<SettingsMap> | null = null;

/** Parse a stored section; if some keys became invalid (schema evolved), drop them and use defaults. */
function parseSection<K extends SettingsKey>(key: K, raw: unknown): SettingsMap[K] {
  const schema = SETTINGS_SCHEMAS[key] as unknown as z.ZodType<SettingsMap[K]>;
  const first = schema.safeParse(raw ?? {});
  if (first.success) return first.data;
  const copy: Record<string, unknown> = { ...((raw as Record<string, unknown>) ?? {}) };
  for (const issue of first.error.issues) {
    const top = issue.path[0];
    if (typeof top === "string") delete copy[top];
  }
  const second = schema.safeParse(copy);
  if (second.success) {
    console.warn(`[settings] "${key}" had invalid fields that were reset to defaults.`);
    return second.data;
  }
  console.error(`[settings] "${key}" is invalid; falling back to defaults.`);
  return schema.parse({});
}

async function loadAll(): Promise<SettingsMap> {
  const rows = await db.select().from(settingsTable);
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Record<SettingsKey, unknown>;
  for (const key of Object.keys(SETTINGS_SCHEMAS) as SettingsKey[]) {
    out[key] = parseSection(key, byKey.get(key));
  }
  return out as SettingsMap;
}

async function getAllUncached(): Promise<SettingsMap> {
  const now = Date.now();
  if (memo && memo.expires > now) return memo.value;
  if (!inflight) {
    inflight = loadAll()
      .then((value) => {
        memo = { value, expires: Date.now() + TTL_MS };
        return value;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** All settings, de-duplicated per request (React cache) and briefly cached per instance. */
export const getSettings = cache(getAllUncached);

export async function getSetting<K extends SettingsKey>(key: K): Promise<SettingsMap[K]> {
  return (await getSettings())[key];
}

export function invalidateSettings() {
  memo = null;
}

export async function saveSetting<K extends SettingsKey>(key: K, value: SettingsMap[K], adminId?: string) {
  const schema = SETTINGS_SCHEMAS[key] as unknown as z.ZodType<SettingsMap[K]>;
  const parsed = schema.parse(value);
  await db
    .insert(settingsTable)
    .values({ key, value: parsed as object, updatedBy: adminId ?? null })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: parsed as object, updatedBy: adminId ?? null, updatedAt: new Date() },
    });
  invalidateSettings();
  return parsed;
}

/* ----------------------------------------------------------------------------
 * Integrations: merge env overrides + decrypt stored secrets
 * ------------------------------------------------------------------------- */

export type TelegramConfig = {
  configured: boolean;
  botToken?: string;
  chatId?: string;
  webhookSecret?: string;
  webhookEnabled: boolean;
  source: "env" | "admin" | "none";
};

export type WhatsAppConfig = {
  provider: "none" | "meta" | "twilio" | "callmebot";
  configured: boolean;
  /** Provider can message arbitrary customers (not just the owner). */
  canMessageCustomers: boolean;
  adminNumber?: string;
  meta?: { token: string; phoneNumberId: string; template?: string; templateLang: string; apiVersion: string };
  twilio?: { sid: string; token: string; from: string };
  callmebot?: { apiKey: string };
  source: "env" | "admin" | "none";
};

export type SmtpConfig = {
  configured: boolean;
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from?: string;
  source: "env" | "admin" | "none";
};

export type Integrations = { telegram: TelegramConfig; whatsapp: WhatsAppConfig; smtp: SmtpConfig };

export async function getIntegrations(): Promise<Integrations> {
  const stored = await getSetting("integrations");
  const e = env();

  // Telegram
  const tgFromEnv = Boolean(e.TELEGRAM_BOT_TOKEN && e.TELEGRAM_ADMIN_CHAT_ID);
  const tgToken = e.TELEGRAM_BOT_TOKEN ?? openSecret(stored.telegram.botTokenEnc);
  const tgChat = e.TELEGRAM_ADMIN_CHAT_ID ?? (stored.telegram.chatId || undefined);
  const telegram: TelegramConfig = {
    configured: Boolean(tgToken && tgChat),
    botToken: tgToken,
    chatId: tgChat,
    webhookSecret: e.TELEGRAM_WEBHOOK_SECRET ?? openSecret(stored.telegram.webhookSecretEnc),
    webhookEnabled: stored.telegram.webhookEnabled,
    source: tgFromEnv ? "env" : tgToken || tgChat ? "admin" : "none",
  };

  // WhatsApp
  const waEnvProvider = e.WHATSAPP_PROVIDER;
  const provider = waEnvProvider ?? stored.whatsapp.provider;
  const w = stored.whatsapp;
  const whatsapp: WhatsAppConfig = {
    provider,
    configured: false,
    canMessageCustomers: false,
    adminNumber: e.WHATSAPP_ADMIN_NUMBER ?? (w.adminNumber || undefined),
    source: waEnvProvider ? "env" : provider !== "none" ? "admin" : "none",
  };
  if (provider === "meta") {
    const token = e.WHATSAPP_META_TOKEN ?? openSecret(w.metaTokenEnc);
    const phoneNumberId = e.WHATSAPP_META_PHONE_NUMBER_ID ?? (w.metaPhoneNumberId || undefined);
    if (token && phoneNumberId) {
      whatsapp.meta = {
        token,
        phoneNumberId,
        template: e.WHATSAPP_META_TEMPLATE ?? (w.metaTemplate || undefined),
        templateLang: e.WHATSAPP_META_TEMPLATE_LANG ?? w.metaTemplateLang ?? "en",
        apiVersion: e.WHATSAPP_META_API_VERSION ?? w.metaApiVersion ?? "v23.0",
      };
      whatsapp.configured = true;
      whatsapp.canMessageCustomers = true;
    }
  } else if (provider === "twilio") {
    const sid = e.WHATSAPP_TWILIO_SID ?? (w.twilioSid || undefined);
    const token = e.WHATSAPP_TWILIO_TOKEN ?? openSecret(w.twilioTokenEnc);
    const from = e.WHATSAPP_TWILIO_FROM ?? (w.twilioFrom || undefined);
    if (sid && token && from) {
      whatsapp.twilio = { sid, token, from };
      whatsapp.configured = true;
      whatsapp.canMessageCustomers = true;
    }
  } else if (provider === "callmebot") {
    const apiKey = e.WHATSAPP_CALLMEBOT_APIKEY ?? openSecret(w.callmebotApiKeyEnc);
    if (apiKey && whatsapp.adminNumber) {
      whatsapp.callmebot = { apiKey };
      whatsapp.configured = true;
      whatsapp.canMessageCustomers = false; // CallMeBot can only message the registered owner.
    }
  }

  // SMTP
  const s = stored.smtp;
  const smtpFromEnv = Boolean(e.SMTP_HOST);
  const smtp: SmtpConfig = smtpFromEnv
    ? {
        configured: Boolean(e.SMTP_HOST && (e.SMTP_FROM || e.SMTP_USER)),
        host: e.SMTP_HOST,
        port: e.SMTP_PORT ?? 587,
        secure: e.SMTP_SECURE ?? (e.SMTP_PORT ?? 587) === 465,
        user: e.SMTP_USER,
        pass: e.SMTP_PASS,
        from: e.SMTP_FROM ?? e.SMTP_USER,
        source: "env",
      }
    : {
        configured: Boolean(s.host && (s.from || s.user)),
        host: s.host || undefined,
        port: s.port,
        secure: s.secure,
        user: s.user || undefined,
        pass: openSecret(s.passEnc),
        from: s.from || s.user || undefined,
        source: s.host ? "admin" : "none",
      };

  return { telegram, whatsapp, smtp };
}

/** Admin-facing view of integration settings – secrets are masked, never returned. */
export async function getIntegrationsForAdmin() {
  const stored = await getSetting("integrations");
  const eff = await getIntegrations();
  return {
    telegram: {
      source: eff.telegram.source,
      configured: eff.telegram.configured,
      chatId: eff.telegram.chatId ?? "",
      botTokenHint: maskSecret(eff.telegram.botToken),
      webhookEnabled: stored.telegram.webhookEnabled,
    },
    whatsapp: {
      source: eff.whatsapp.source,
      configured: eff.whatsapp.configured,
      provider: eff.whatsapp.provider,
      adminNumber: eff.whatsapp.adminNumber ?? "",
      metaPhoneNumberId: stored.whatsapp.metaPhoneNumberId,
      metaTemplate: stored.whatsapp.metaTemplate,
      metaTemplateLang: stored.whatsapp.metaTemplateLang,
      metaApiVersion: stored.whatsapp.metaApiVersion,
      metaTokenHint: maskSecret(openSecret(stored.whatsapp.metaTokenEnc)),
      twilioSid: stored.whatsapp.twilioSid,
      twilioFrom: stored.whatsapp.twilioFrom,
      twilioTokenHint: maskSecret(openSecret(stored.whatsapp.twilioTokenEnc)),
      callmebotKeyHint: maskSecret(openSecret(stored.whatsapp.callmebotApiKeyEnc)),
    },
    smtp: {
      source: eff.smtp.source,
      configured: eff.smtp.configured,
      host: stored.smtp.host,
      port: stored.smtp.port,
      secure: stored.smtp.secure,
      user: stored.smtp.user,
      from: stored.smtp.from,
      passHint: maskSecret(openSecret(stored.smtp.passEnc)),
    },
  };
}

export type IntegrationsAdminView = Awaited<ReturnType<typeof getIntegrationsForAdmin>>;

/**
 * Apply a secret update: `undefined` keeps the stored ciphertext, `""` clears it,
 * any other value is encrypted.
 */
export function updateSecret(current: string, next: string | undefined, context = "settings"): string {
  if (next === undefined) return current;
  if (next === "") return "";
  return sealSecret(next, context);
}

export type { IntegrationsStored };
