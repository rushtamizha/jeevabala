import { db } from "@/db";
import { travelRoutes } from "@/db/schema";
import { routeSchema } from "@/lib/admin-schemas";
import { audit } from "@/lib/server/audit";
import { route } from "@/lib/server/api";
import { normalizeRoute, uniqueGuard } from "@/lib/server/catalog-admin";

export const POST = route({ auth: "admin", body: routeSchema, maxBodyBytes: 64 * 1024 }, async ({ admin, body, ip, userAgent }) => {
  const [row] = await uniqueGuard(() => db.insert(travelRoutes).values(normalizeRoute(body)).returning({ id: travelRoutes.id }), "A route with this slug already exists.");
  await audit({ actorType: "ADMIN", actorId: admin!.id, action: "route.create", entityType: "route", entityId: row.id, ip, userAgent });
  return { id: row.id };
});
