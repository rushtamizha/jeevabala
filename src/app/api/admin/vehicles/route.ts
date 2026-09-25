import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { conflict, route } from "@/lib/server/api";
import { normalizeVehicle } from "@/lib/server/catalog-admin";
import { audit } from "@/lib/server/audit";
import { vehicleSchema } from "@/lib/admin-schemas";

export const POST = route({ auth: "admin", body: vehicleSchema }, async ({ admin, body, ip, userAgent }) => {
  const [v] = await db.insert(vehicles).values(normalizeVehicle(body)).onConflictDoNothing().returning();
  if (!v) throw conflict("A vehicle with this slug already exists.");
  await audit({ actorType: "ADMIN", actorId: admin!.id, action: "vehicle.create", entityType: "vehicle", entityId: v.id, ip, userAgent });
  return { id: v.id };
});
