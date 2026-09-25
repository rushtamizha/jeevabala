import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema";
import { citySchema } from "@/lib/admin-schemas";
import { audit } from "@/lib/server/audit";
import { notFound, param, route } from "@/lib/server/api";
import { normalizeCity, uniqueGuard } from "@/lib/server/catalog-admin";
import { uuidSchema } from "@/lib/validation";

function rowId(params: Record<string, string | string[] | undefined>) {
  const id = uuidSchema.safeParse(param(params, "id"));
  if (!id.success) throw notFound();
  return id.data;
}

export const PATCH = route({ auth: "admin", body: citySchema, maxBodyBytes: 64 * 1024 }, async ({ admin, params, body, ip, userAgent }) => {
  const id = rowId(params);
  const rows = await uniqueGuard(
    () => db.update(cities).set({ ...normalizeCity(body), updatedAt: sql`now()` }).where(eq(cities.id, id)).returning({ id: cities.id }),
    "A city with this slug already exists.",
  );
  if (!rows.length) throw notFound();
  await audit({ actorType: "ADMIN", actorId: admin!.id, action: "city.update", entityType: "city", entityId: id, ip, userAgent });
  return { ok: true };
});

export const DELETE = route({ auth: "admin" }, async ({ admin, params, ip, userAgent }) => {
  const id = rowId(params);
  const rows = await db.delete(cities).where(eq(cities.id, id)).returning({ id: cities.id });
  if (!rows.length) throw notFound();
  await audit({ actorType: "ADMIN", actorId: admin!.id, action: "city.delete", entityType: "city", entityId: id, ip, userAgent });
  return { ok: true };
});
