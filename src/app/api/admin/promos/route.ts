import { db } from "@/db";
import { promoCodes } from "@/db/schema";
import { conflict, route } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { promoSchema, toPromoRow } from "./schema";

export const POST = route({ auth: "admin", body: promoSchema }, async ({ admin, body, ip, userAgent }) => {
  const [p] = await db.insert(promoCodes).values(toPromoRow(body)).onConflictDoNothing({ target: promoCodes.code }).returning();
  if (!p) throw conflict("A promo code with this name already exists.");
  await audit({ actorType: "ADMIN", actorId: admin!.id, action: "promo.create", entityType: "promo", entityId: p.id, meta: { code: p.code }, ip, userAgent });
  return { id: p.id };
});
