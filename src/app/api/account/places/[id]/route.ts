import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { savedPlaces } from "@/db/schema";
import { notFound, param, route } from "@/lib/server/api";
import { uuidSchema } from "@/lib/validation";

export const DELETE = route({ auth: "customer" }, async ({ customer, params }) => {
  const id = uuidSchema.safeParse(param(params, "id"));
  if (!id.success) throw notFound();
  const deleted = await db
    .delete(savedPlaces)
    .where(and(eq(savedPlaces.id, id.data), eq(savedPlaces.customerId, customer!.id)))
    .returning({ id: savedPlaces.id });
  if (!deleted.length) throw notFound();
  return { ok: true };
});
