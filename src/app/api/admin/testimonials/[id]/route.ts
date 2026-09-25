import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { testimonials } from "@/db/schema";
import { testimonialSchema } from "@/lib/admin-schemas";
import { audit } from "@/lib/server/audit";
import { notFound, param, route } from "@/lib/server/api";
import { normalizeTestimonial, uniqueGuard } from "@/lib/server/catalog-admin";
import { uuidSchema } from "@/lib/validation";

function rowId(params: Record<string, string | string[] | undefined>) {
  const id = uuidSchema.safeParse(param(params, "id"));
  if (!id.success) throw notFound();
  return id.data;
}

export const PATCH = route({ auth: "admin", body: testimonialSchema, maxBodyBytes: 64 * 1024 }, async ({ admin, params, body, ip, userAgent }) => {
  const id = rowId(params);
  const rows = await uniqueGuard(
    () => db.update(testimonials).set({ ...normalizeTestimonial(body), updatedAt: sql`now()` }).where(eq(testimonials.id, id)).returning({ id: testimonials.id }),
    "Duplicate testimonial.",
  );
  if (!rows.length) throw notFound();
  await audit({ actorType: "ADMIN", actorId: admin!.id, action: "testimonial.update", entityType: "testimonial", entityId: id, ip, userAgent });
  return { ok: true };
});

export const DELETE = route({ auth: "admin" }, async ({ admin, params, ip, userAgent }) => {
  const id = rowId(params);
  const rows = await db.delete(testimonials).where(eq(testimonials.id, id)).returning({ id: testimonials.id });
  if (!rows.length) throw notFound();
  await audit({ actorType: "ADMIN", actorId: admin!.id, action: "testimonial.delete", entityType: "testimonial", entityId: id, ip, userAgent });
  return { ok: true };
});
