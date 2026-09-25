import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { badRequest, notFound, param, route } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { revokeAllAdminSessions } from "@/lib/server/session";

/** DELETE /api/admin/security/sessions/<id|others> */
export const DELETE = route({ auth: "admin" }, async ({ admin, adminSessionId, params, ip, userAgent }) => {
  const id = param(params, "id");
  if (id === "others") {
    await revokeAllAdminSessions(admin!.id, adminSessionId!);
  } else {
    if (!/^[a-f0-9]{64}$/.test(id)) throw notFound();
    if (id === adminSessionId) throw badRequest("Use sign out to end the current session.");
    const rows = await db
      .delete(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.adminId, admin!.id)))
      .returning({ id: sessions.id });
    if (!rows.length) throw notFound();
  }
  await audit({ actorType: "ADMIN", actorId: admin!.id, action: "admin.session_revoke", meta: { scope: id === "others" ? "others" : "one" }, ip, userAgent });
  return { ok: true };
});
