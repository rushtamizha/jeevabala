import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { ApiError, route, unprocessable } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "@/lib/server/crypto";
import { createSession, revokeAllAdminSessions } from "@/lib/server/session";

export const POST = route(
  {
    auth: "admin",
    body: z.object({ current: z.string().min(1).max(256), next: z.string().min(1).max(256) }),
    rateLimit: [{ name: "adminpw", limit: 5, windowSec: 900, by: "admin" }],
  },
  async ({ admin, body, ip, userAgent }) => {
    const a = admin!;
    if (!(await verifyPassword(body.current, a.passwordHash))) {
      throw new ApiError(400, "Current password is incorrect.", "invalid_password", { fields: { current: "Incorrect password" } });
    }
    const policy = checkPasswordPolicy(body.next, [a.email, a.name]);
    if (!policy.ok) throw unprocessable(policy.reason, { fields: { next: policy.reason } });
    if (await verifyPassword(body.next, a.passwordHash)) throw unprocessable("Choose a password you haven’t used here.");
    await db.update(admins).set({ passwordHash: await hashPassword(body.next), passwordChangedAt: new Date() }).where(eq(admins.id, a.id));
    // Sign out every device, then re-issue a session for this one.
    await revokeAllAdminSessions(a.id);
    await createSession({ kind: "ADMIN", subjectId: a.id, ip, userAgent });
    await audit({ actorType: "ADMIN", actorId: a.id, action: "admin.password_change", ip, userAgent });
    return { ok: true };
  },
);
