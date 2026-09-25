import { route } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { readAdminSession, revokeCurrentSession } from "@/lib/server/session";

export const POST = route({}, async ({ ip, userAgent }) => {
  const s = await readAdminSession({ allowMfaPending: true });
  await revokeCurrentSession("ADMIN");
  if (s) await audit({ actorType: "ADMIN", actorId: s.admin.id, action: "admin.logout", ip, userAgent });
  return { ok: true };
});
