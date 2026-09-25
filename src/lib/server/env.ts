import "server-only";
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", "yes", "no"])
  .transform((v) => v === "true" || v === "1" || v === "yes");

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /* Core */
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.url("APP_URL must be the absolute public URL, e.g. https://cabs.example.com"),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters (use npm run secrets:generate)"),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[A-Fa-f0-9]{64}$/, "ENCRYPTION_KEY must be 64 hex characters (32 bytes)"),
  ALLOWED_ORIGINS: z.string().optional(),

  /* Networking */
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  TRUST_CLOUDFLARE: bool.default(false),

  /* Jobs */
  CRON_SECRET: z.string().min(24).optional(),

  /* Maps */
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  PHOTON_URL: z.url().default("https://photon.komoot.io"),
  OSRM_URL: z.url().default("https://router.project-osrm.org"),

  /* Bot protection (optional, Cloudflare Turnstile) */
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),

  /* Integrations – optional overrides for values configured in Admin → Settings → Integrations */
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ADMIN_CHAT_ID: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(24).optional(),

  WHATSAPP_PROVIDER: z.enum(["meta", "twilio", "callmebot"]).optional(),
  WHATSAPP_ADMIN_NUMBER: z.string().optional(),
  WHATSAPP_META_TOKEN: z.string().optional(),
  WHATSAPP_META_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_META_TEMPLATE: z.string().optional(),
  WHATSAPP_META_TEMPLATE_LANG: z.string().optional(),
  WHATSAPP_META_API_VERSION: z.string().optional(),
  WHATSAPP_TWILIO_SID: z.string().optional(),
  WHATSAPP_TWILIO_TOKEN: z.string().optional(),
  WHATSAPP_TWILIO_FROM: z.string().optional(),
  WHATSAPP_CALLMEBOT_APIKEY: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: bool.optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  ADMIN_NOTIFY_EMAIL: z.email().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/**
 * Validated environment. Parsed lazily (first call) so that `next build` does not
 * require runtime secrets. Empty strings are treated as "unset".
 */
export function env(): Env {
  if (cached) return cached;
  const raw: Record<string, string | undefined> = {};
  for (const key of Object.keys(EnvSchema.shape)) {
    const v = process.env[key];
    raw[key] = v === undefined || v.trim() === "" ? undefined : v.trim();
  }
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.APP_URL.startsWith("https://")) {
    console.warn("[env] APP_URL is not https:// in production – secure cookies require HTTPS.");
  }
  cached = parsed.data;
  return cached;
}

export const isProd = () => process.env.NODE_ENV === "production";

/**
 * Public base URL. Reads only APP_URL (falling back to Vercel's production
 * domain), so canonical URLs, robots.txt and the sitemap can be produced during
 * `next build` before runtime secrets exist. With neither set it defers to
 * env(), which throws the full, readable configuration error.
 */
export function publicBaseUrl(): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return env().APP_URL.replace(/\/$/, "");
}

export function appOrigin(): string {
  return new URL(publicBaseUrl()).origin;
}

export function absoluteUrl(path: string): string {
  return new URL(path, publicBaseUrl()).toString();
}
