import { db } from "@/db";
import { testimonials } from "@/db/schema";
import { testimonialSchema } from "@/lib/admin-schemas";
import { audit } from "@/lib/server/audit";
import { route } from "@/lib/server/api";
import { normalizeTestimonial, uniqueGuard } from "@/lib/server/catalog-admin";

export const POST = route({ auth: "admin", body: testimonialSchema, maxBodyBytes: 64 * 1024 }, async ({ admin, body, ip, userAgent }) => {
  const [row] = await uniqueGuard(() => db.insert(testimonials).values(normalizeTestimonial(body)).returning({ id: testimonials.id }), "Duplicate testimonial.");
  await audit({ actorType: "ADMIN", actorId: admin!.id, action: "testimonial.create", entityType: "testimonial", entityId: row.id, ip, userAgent });
  return { id: row.id };
});
