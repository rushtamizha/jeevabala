import "server-only";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { otpCodes } from "@/db/schema";
import { maskEmail } from "@/lib/format";
import { randomDigits } from "./crypto";
import { isProd } from "./env";
import { sign, verifySignature } from "./keys";
import { renderEmail, sendEmail } from "./notify/email";
import { getIntegrations, getSetting } from "./settings";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;

const otpMac = (email: string, id: string, code: string) => sign("otp", `${email}|${id}|${code}`, 43);

export type OtpRequestResult =
  | { ok: true; resendInSec: number; maskedEmail: string; devHint?: boolean }
  | { ok: false; reason: "cooldown"; resendInSec: number }
  | { ok: false; reason: "unavailable" };

export async function otpDeliveryAvailable(): Promise<boolean> {
  if (!isProd()) return true;
  return (await getIntegrations()).smtp.configured;
}

/**
 * Issue a one-time login code. Responses are identical whether or not an account
 * exists, so this endpoint cannot be used to enumerate customers.
 */
export async function requestOtp(email: string, ip: string): Promise<OtpRequestResult> {
  const [latest] = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(and(eq(otpCodes.email, email), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return {
      ok: false,
      reason: "cooldown",
      resendInSec: Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - latest.createdAt.getTime())) / 1000),
    };
  }

  const integ = await getIntegrations();
  if (!integ.smtp.configured && isProd()) return { ok: false, reason: "unavailable" };

  const code = randomDigits(6);
  // Invalidate older unconsumed codes for this email.
  await db
    .update(otpCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpCodes.email, email), isNull(otpCodes.consumedAt)));
  const [row] = await db
    .insert(otpCodes)
    .values({ email, codeHash: "pending", expiresAt: new Date(Date.now() + OTP_TTL_MS), ip })
    .returning({ id: otpCodes.id });
  await db.update(otpCodes).set({ codeHash: otpMac(email, row.id, code) }).where(eq(otpCodes.id, row.id));

  const business = await getSetting("business");
  if (integ.smtp.configured) {
    const mail = renderEmail({
      brand: business.name,
      preheader: `${code} is your ${business.name} verification code`,
      title: "Your verification code",
      blocks: [
        { type: "p", text: "Use this code to verify your email and continue. It expires in 10 minutes." },
        { type: "code", text: code },
        { type: "note", text: "Never share this code with anyone — including the driver. If you didn’t request it, you can safely ignore this email." },
      ],
    });
    try {
      await sendEmail(integ.smtp, { to: email, subject: `${code} is your verification code`, ...mail }, business.name);
    } catch (err) {
      console.error("[otp] email delivery failed:", (err as Error).message);
      if (isProd()) return { ok: false, reason: "unavailable" };
    }
  }
  if (!isProd()) {
    // Development convenience only – never logged in production.
    console.info(`\n[otp] 🔐 Verification code for ${email}: ${code}\n`);
  }
  return {
    ok: true,
    resendInSec: RESEND_COOLDOWN_MS / 1000,
    maskedEmail: maskEmail(email),
    devHint: !isProd() && !integ.smtp.configured ? true : undefined,
  };
}

export type OtpVerifyResult = { ok: true } | { ok: false; reason: "invalid" | "expired" | "locked" };

export async function verifyOtp(email: string, code: string): Promise<OtpVerifyResult> {
  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.email, email), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!row) return { ok: false, reason: "expired" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "locked" };

  // Count the attempt first (atomically) so parallel guesses can't exceed the limit.
  const [bumped] = await db
    .update(otpCodes)
    .set({ attempts: sql`${otpCodes.attempts} + 1` })
    .where(and(eq(otpCodes.id, row.id), lt(otpCodes.attempts, MAX_ATTEMPTS), isNull(otpCodes.consumedAt)))
    .returning({ attempts: otpCodes.attempts });
  if (!bumped) return { ok: false, reason: "locked" };

  if (!verifySignature("otp", `${email}|${row.id}|${code}`, row.codeHash, 43)) {
    return { ok: false, reason: bumped.attempts >= MAX_ATTEMPTS ? "locked" : "invalid" };
  }
  const [consumed] = await db
    .update(otpCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpCodes.id, row.id), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())))
    .returning({ id: otpCodes.id });
  return consumed ? { ok: true } : { ok: false, reason: "expired" };
}

export async function purgeOldOtps() {
  await db.delete(otpCodes).where(lt(otpCodes.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
}
