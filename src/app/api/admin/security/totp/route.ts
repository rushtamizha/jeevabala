import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { ApiError, conflict, route, unprocessable } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { generateRecoveryCodes, generateTotpSecret, sha256Hex, totpUri, verifyPassword, verifyTotp } from "@/lib/server/crypto";
import { openSecret, sealSecret } from "@/lib/server/keys";
import { qrPath } from "@/lib/server/qr";
import { getSetting } from "@/lib/server/settings";

export const POST = route(
  {
    auth: "admin",
    body: z.discriminatedUnion("action", [
      z.object({ action: z.literal("setup") }),
      z.object({ action: z.literal("enable"), code: z.string().regex(/^\d{6}$/) }),
      z.object({ action: z.literal("disable"), password: z.string().min(1).max(256), code: z.string().regex(/^\d{6}$/) }),
      z.object({ action: z.literal("recovery"), password: z.string().min(1).max(256) }),
    ]),
    rateLimit: [{ name: "admintotp", limit: 15, windowSec: 900, by: "admin" }],
  },
  async ({ admin, body, ip, userAgent }) => {
    const a = admin!;
    const brand = (await getSetting("business")).name;

    if (body.action === "setup") {
      if (a.totpEnabled) throw conflict("Two-factor authentication is already enabled.");
      const secret = generateTotpSecret();
      await db.update(admins).set({ totpPendingSecretEnc: sealSecret(secret, "totp") }).where(eq(admins.id, a.id));
      const uri = totpUri(secret, a.email, brand);
      return { secret, qr: qrPath(uri) };
    }

    if (body.action === "enable") {
      const secret = openSecret(a.totpPendingSecretEnc, "totp");
      if (!secret) throw unprocessable("Start the setup again.");
      const counter = verifyTotp(secret, body.code);
      if (counter === null) throw new ApiError(400, "That code isn’t valid. Check your authenticator’s time.", "invalid_code", { fields: { code: "Invalid" } });
      const codes = generateRecoveryCodes();
      await db
        .update(admins)
        .set({
          totpSecretEnc: sealSecret(secret, "totp"),
          totpPendingSecretEnc: null,
          totpEnabled: true,
          totpLastCounter: counter,
          recoveryCodes: codes.map((c) => sha256Hex(c)),
        })
        .where(eq(admins.id, a.id));
      await audit({ actorType: "ADMIN", actorId: a.id, action: "admin.2fa_enable", ip, userAgent });
      return { recoveryCodes: codes };
    }

    if (!(await verifyPassword(body.password, a.passwordHash))) {
      throw new ApiError(400, "Password is incorrect.", "invalid_password", { fields: { password: "Incorrect password" } });
    }

    if (body.action === "recovery") {
      if (!a.totpEnabled) throw unprocessable("Enable two-factor authentication first.");
      const codes = generateRecoveryCodes();
      await db.update(admins).set({ recoveryCodes: codes.map((c) => sha256Hex(c)) }).where(eq(admins.id, a.id));
      await audit({ actorType: "ADMIN", actorId: a.id, action: "admin.2fa_recovery_regenerate", ip, userAgent });
      return { recoveryCodes: codes };
    }

    const secret = openSecret(a.totpSecretEnc, "totp");
    if (!secret || verifyTotp(secret, body.code, { lastCounter: a.totpLastCounter }) === null) {
      throw new ApiError(400, "That code isn’t valid.", "invalid_code", { fields: { code: "Invalid" } });
    }
    await db
      .update(admins)
      .set({ totpEnabled: false, totpSecretEnc: null, totpLastCounter: null, recoveryCodes: [] })
      .where(eq(admins.id, a.id));
    await audit({ actorType: "ADMIN", actorId: a.id, action: "admin.2fa_disable", ip, userAgent });
    return { ok: true };
  },
);
