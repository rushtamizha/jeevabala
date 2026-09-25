import { and, count, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { notFound, param, route, unprocessable } from "@/lib/server/api";
import { normalizeVehicle, uniqueGuard } from "@/lib/server/catalog-admin";
import { audit } from "@/lib/server/audit";
import { uuidSchema } from "@/lib/validation";
import { vehicleSchema } from "@/lib/admin-schemas";

function vid(params: Record<string, string | string[] | undefined>) {
  const id = uuidSchema.safeParse(param(params, "id"));
  if (!id.success) throw notFound();
  return id.data;
}

async function assertAnotherActive(id: string) {
  const [n] = await db.select({ n: count() }).from(vehicles).where(and(eq(vehicles.isActive, true), ne(vehicles.id, id)));
  if (Number(n?.n ?? 0) === 0) throw unprocessable("Keep at least one active vehicle.");
}

export const PATCH = route({ auth: "admin", body: vehicleSchema }, async ({ admin, params, body, ip, userAgent }) => {
  const id = vid(params);
  if (!body.isActive) await assertAnotherActive(id);
  const [v] = await uniqueGuard(() => db.update(vehicles).set(normalizeVehicle(body)).where(eq(vehicles.id, id)).returning(), "Another vehicle already uses this slug.");
  if (!v) throw notFound();
  await audit({ actorType: "ADMIN", actorId: admin!.id, action: "vehicle.update", entityType: "vehicle", entityId: id, ip, userAgent });
  return { ok: true };
});

export const DELETE = route({ auth: "admin" }, async ({ admin, params, ip, userAgent }) => {
  const id = vid(params);
  await assertAnotherActive(id);
  const deleted = await db.delete(vehicles).where(eq(vehicles.id, id)).returning({ id: vehicles.id });
  if (!deleted.length) throw notFound();
  await audit({ actorType: "ADMIN", actorId: admin!.id, action: "vehicle.delete", entityType: "vehicle", entityId: id, ip, userAgent });
  return { ok: true };
});
