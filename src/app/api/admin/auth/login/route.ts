import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { ApiError, route, tooManyRequests } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { dummyPasswordHash, hashPassword, passwordNeedsRehash, verifyPassword } from "@/lib/server/crypto";
import { rateLimit } from "@/lib/server/rate-limit";
import { createSession, revokeCurrentSession } from "@/lib/server/session";
import { emailSchema } from "@/lib/validation";

const INVALID = () => new ApiError(401, "Invalid email or password.", "invalid_credentials");
const LOCK_THRESHOLD = 5;

export const POST = route(
  {
    body: z.object({ email: emailSchema, password: z.string().min(1).max(256) }),
    rateLimit: [
      { name: "adminlogin:ip:15m", limit: 10, windowSec: 900 },
      { name: "adminlogin:ip:1d", limit: 50, windowSec: 86400 },
    ],
  },
  async ({ body, ip, userAgent }) => {
    const perAccount = await rateLimit(`adminlogin:email:${body.email}`, 10, 3600);
    if (!perAccount.ok) throw tooManyRequests(perAccount.retryAfterSec, "Too many sign-in attempts. Try again later.");

    const [admin] = await db.select().from(admins).where(eq(admins.email, body.email)).limit(1);
    if (!admin) {
      // Equalise timing so response time doesn't reveal whether the account exists.
      await verifyPassword(body.password, await dummyPasswordHash());
      await audit({ actorType: "SYSTEM", action: "admin.login_failed", meta: { reason: "unknown_email" }, ip, userAgent });
      throw INVALID();
    }
    if (admin.lockedUntil && admin.lockedUntil.getTime() > Date.now()) {
      throw tooManyRequests(Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 1000), "Too many sign-in attempts. Try again later.");
    }

    const ok = await verifyPassword(body.password, admin.passwordHash);
    if (!ok) {
      const failed = admin.failedLogins + 1;
      const lockMinutes = failed >= LOCK_THRESHOLD ? Math.min(24 * 60, 15 * 2 ** (failed - LOCK_THRESHOLD)) : 0;
      await db
        .update(admins)
        .set({ failedLogins: failed, lockedUntil: lockMinutes ? new Date(Date.now() + lockMinutes * 60_000) : null })
        .where(eq(admins.id, admin.id));
      await audit({ actorType: "ADMIN", actorId: admin.id, action: "admin.login_failed", meta: { failed, lockMinutes }, ip, userAgent });
      throw INVALID();
    }

    await db
      .update(admins)
      .set({
        failedLogins: 0,
        lockedUntil: null,
        ...(passwordNeedsRehash(admin.passwordHash) ? { passwordHash: await hashPassword(body.password) } : {}),
      })
      .where(eq(admins.id, admin.id));

    await revokeCurrentSession("ADMIN");
    if (admin.totpEnabled) {
      await createSession({ kind: "ADMIN", subjectId: admin.id, ip, userAgent, mfaPending: true });
      await audit({ actorType: "ADMIN", actorId: admin.id, action: "admin.login_password_ok", ip, userAgent });
      return { mfaRequired: true };
    }
    await createSession({ kind: "ADMIN", subjectId: admin.id, ip, userAgent });
    await db.update(admins).set({ lastLoginAt: new Date(), lastLoginIp: ip }).where(eq(admins.id, admin.id));
    await audit({ actorType: "ADMIN", actorId: admin.id, action: "admin.login", ip, userAgent });
    return { mfaRequired: false, totpEnabled: false };
  },
);
