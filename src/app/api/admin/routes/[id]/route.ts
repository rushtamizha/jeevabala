import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { travelRoutes } from "@/db/schema";
import { routeSchema } from "@/lib/admin-schemas";
import { audit } from "@/lib/server/audit";
import { notFound, param, route } from "@/lib/server/api";
import { normalizeRoute, uniqueGuard } from "@/lib/server/catalog-admin";
import { uuidSchema } from "@/lib/validation";

function rowId(params: Record<string, string | string[] | undefined>) {
  const id = uuidSchema.safeParse(param(params, "id"));
  if (!id.success) throw notFound();
  return id.data;
}

export const PATCH = route({ auth: "admin", body: routeSchema, maxBodyBytes: 64 * 1024 }, async ({ admin, params, body, ip, userAgent }) => {
  const id = rowId(params);
  const rows = await uniqueGuard(
    () => db.update(travelRoutes).set({ ...normalizeRoute(body), updatedAt: sql`now()` }).where(eq(travelRoutes.id, id)).returning({ id: travelRoutes.id }),
    "A route with this slug already exists.",
  );
  if (!rows.length) throw notFound();
  await audit({ actorType: "ADMIN", actorId: admin!.id, action: "route.update", entityType: "route", entityId: id, ip, userAgent });
  return { ok: true };
});

export const DELETE = route({ auth: "admin" }, async ({ admin, params, ip, userAgent }) => {
  const id = rowId(params);
  const rows = await db.delete(travelRoutes).where(eq(travelRoutes.id, id)).returning({ id: travelRoutes.id });
  if (!rows.length) throw notFound();
  await audit({ actorType: "ADMIN", actorId: admin!.id, action: "route.delete", entityType: "route", entityId: id, ip, userAgent });
  return { ok: true };
});
