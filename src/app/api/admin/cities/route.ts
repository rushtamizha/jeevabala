import { db } from "@/db";
import { cities } from "@/db/schema";
import { citySchema } from "@/lib/admin-schemas";
import { audit } from "@/lib/server/audit";
import { route } from "@/lib/server/api";
import { normalizeCity, uniqueGuard } from "@/lib/server/catalog-admin";

export const POST = route({ auth: "admin", body: citySchema, maxBodyBytes: 64 * 1024 }, async ({ admin, body, ip, userAgent }) => {
  const [row] = await uniqueGuard(() => db.insert(cities).values(normalizeCity(body)).returning({ id: cities.id }), "A city with this slug already exists.");
  await audit({ actorType: "ADMIN", actorId: admin!.id, action: "city.create", entityType: "city", entityId: row.id, ip, userAgent });
  return { id: row.id };
});
