import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blackouts } from "@/db/schema";
import { notFound, param, route } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { uuidSchema } from "@/lib/validation";

export const DELETE = route({ auth: "admin" }, async ({ admin, params, ip, userAgent }) => {
  const id = uuidSchema.safeParse(param(params, "id"));
  if (!id.success) throw notFound();
  const rows = await db.delete(blackouts).where(eq(blackouts.id, id.data)).returning({ id: blackouts.id });
  if (!rows.length) throw notFound();
  await audit({ actorType: "ADMIN", actorId: admin!.id, action: "blackout.delete", entityType: "blackout", entityId: id.data, ip, userAgent });
  return { ok: true };
});
