import "server-only";
import type { WhatsAppConfig } from "../settings";

/** WhatsApp accepts plain text; strip control characters and cap length. */
function sanitize(text: string, max = 4000) {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, max);
}

const digits = (phone: string) => phone.replace(/\D/g, "");

async function metaSend(cfg: NonNullable<WhatsAppConfig["meta"]>, to: string, text: string) {
  const url = `https://graph.facebook.com/${encodeURIComponent(cfg.apiVersion)}/${encodeURIComponent(cfg.phoneNumberId)}/messages`;
  // Business-initiated messages outside the 24h window require an approved template.
  // Configure a UTILITY template with a single body variable {{1}} to use it.
  const body = cfg.template
    ? {
        messaging_product: "whatsapp",
        to: digits(to),
        type: "template",
        template: {
          name: cfg.template,
          language: { code: cfg.templateLang || "en" },
          components: [
            {
              type: "body",
              // Template variables may not contain newlines/tabs or 4+ consecutive spaces.
              parameters: [{ type: "text", text: sanitize(text, 1000).replace(/\s*\n+\s*/g, " · ").replace(/\s{4,}/g, " ") }],
            },
          ],
        },
      }
    : { messaging_product: "whatsapp", to: digits(to), type: "text", text: { body: sanitize(text), preview_url: true } };

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(`WhatsApp Cloud API ${res.status}: ${err?.error?.message ?? "request failed"}`);
  }
}

async function twilioSend(cfg: NonNullable<WhatsAppConfig["twilio"]>, to: string, text: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.sid)}/Messages.json`;
  const from = cfg.from.startsWith("whatsapp:") ? cfg.from : `whatsapp:${cfg.from}`;
  const form = new URLSearchParams({ From: from, To: `whatsapp:+${digits(to)}`, Body: sanitize(text, 1500) });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(`Twilio ${res.status}: ${err?.message ?? "request failed"}`);
  }
}

async function callmebotSend(cfg: NonNullable<WhatsAppConfig["callmebot"]>, to: string, text: string) {
  const url = new URL("https://api.callmebot.com/whatsapp.php");
  url.searchParams.set("phone", `+${digits(to)}`);
  url.searchParams.set("text", sanitize(text, 1500));
  url.searchParams.set("apikey", cfg.apiKey);
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  const body = await res.text();
  if (!res.ok || /error|invalid/i.test(body.slice(0, 300))) {
    throw new Error(`CallMeBot ${res.status}: ${body.replace(/<[^>]+>/g, " ").trim().slice(0, 160)}`);
  }
}

export async function sendWhatsApp(cfg: WhatsAppConfig, to: string, text: string) {
  if (!cfg.configured) throw new Error("WhatsApp is not configured");
  if (digits(to).length < 10) throw new Error("Invalid WhatsApp number");
  if (cfg.provider === "meta" && cfg.meta) return metaSend(cfg.meta, to, text);
  if (cfg.provider === "twilio" && cfg.twilio) return twilioSend(cfg.twilio, to, text);
  if (cfg.provider === "callmebot" && cfg.callmebot) return callmebotSend(cfg.callmebot, to, text);
  throw new Error("Unsupported WhatsApp provider");
}

/** Click-to-chat link (no API needed) – used for manual messages from the admin panel. */
export function waLink(phone: string, text?: string) {
  const url = new URL(`https://wa.me/${digits(phone)}`);
  if (text) url.searchParams.set("text", text);
  return url.toString();
}
