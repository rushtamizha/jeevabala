import { eq } from "drizzle-orm";
import { db } from "@/db";
import { promoCodes } from "@/db/schema";
import { notFound, param, route } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { uuidSchema } from "@/lib/validation";
import { promoSchema, toPromoRow } from "../schema";

function pid(params: Record<string, string | string[] | undefined>) {
  const id = uuidSchema.safeParse(param(params, "id"));
  if (!id.success) throw notFound();
  return id.data;
}

export const PATCH = route({ auth: "admin", body: promoSchema }, async ({ admin, params, body, ip, userAgent }) => {
  const id = pid(params);
  const [p] = await db.update(promoCodes).set(toPromoRow(body)).where(eq(promoCodes.id, id)).returning();
  if (!p) throw notFound();
  await audit({ actorType: "ADMIN", actorId: admin!.id, action: "promo.update", entityType: "promo", entityId: id, ip, userAgent });
  return { ok: true };
});

/** Soft-delete: promos referenced by bookings are deactivated instead of removed. */
export const DELETE = route({ auth: "admin" }, async ({ admin, params, ip, userAgent }) => {
  const id = pid(params);
  const [p] = await db.update(promoCodes).set({ isActive: false }).where(eq(promoCodes.id, id)).returning();
  if (!p) throw notFound();
  await audit({ actorType: "ADMIN", actorId: admin!.id, action: "promo.deactivate", entityType: "promo", entityId: id, ip, userAgent });
  return { ok: true };
});
