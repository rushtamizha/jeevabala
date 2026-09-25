import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { ApiError, route } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { sha256Hex, verifyTotp } from "@/lib/server/crypto";
import { openSecret } from "@/lib/server/keys";
import { createSession, revokeSessionById } from "@/lib/server/session";

export const POST = route(
  {
    auth: "admin-mfa-pending",
    body: z.object({ code: z.string().trim().min(6).max(16) }),
    rateLimit: [{ name: "adminmfa", limit: 10, windowSec: 900 }],
  },
  async ({ admin, adminSessionId, body, ip, userAgent }) => {
    const a = admin!;
    const code = body.code.replace(/\s+/g, "").toUpperCase();
    let method: "totp" | "recovery" | null = null;

    const secret = openSecret(a.totpSecretEnc, "totp");
    if (/^\d{6}$/.test(code) && secret) {
      const counter = verifyTotp(secret, code, { lastCounter: a.totpLastCounter });
      if (counter !== null) {
        await db.update(admins).set({ totpLastCounter: counter }).where(eq(admins.id, a.id));
        method = "totp";
      }
    } else if (/^[A-Z0-9]{5}-?[A-Z0-9]{5}$/.test(code)) {
      const normalized = code.includes("-") ? code : `${code.slice(0, 5)}-${code.slice(5)}`;
      const hash = sha256Hex(normalized);
      if (a.recoveryCodes.includes(hash)) {
        await db
          .update(admins)
          .set({ recoveryCodes: a.recoveryCodes.filter((h) => h !== hash) })
          .where(eq(admins.id, a.id));
        method = "recovery";
      }
    }

    if (!method) {
      await audit({ actorType: "ADMIN", actorId: a.id, action: "admin.mfa_failed", ip, userAgent });
      throw new ApiError(400, "That code isn’t valid. Try again.", "invalid_code", { fields: { code: "Invalid code" } });
    }

    await revokeSessionById(adminSessionId!);
    await createSession({ kind: "ADMIN", subjectId: a.id, ip, userAgent });
    await db.update(admins).set({ lastLoginAt: new Date(), lastLoginIp: ip }).where(eq(admins.id, a.id));
    await audit({ actorType: "ADMIN", actorId: a.id, action: "admin.login", meta: { mfa: method }, ip, userAgent });
    return { ok: true, recoveryCodesLeft: method === "recovery" ? a.recoveryCodes.length - 1 : undefined };
  },
);
