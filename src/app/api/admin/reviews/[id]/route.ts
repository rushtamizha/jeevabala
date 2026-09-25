import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { notFound, param, route } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { safeText, uuidSchema } from "@/lib/validation";

export const PATCH = route(
  { auth: "admin", body: z.object({ isPublished: z.boolean().optional(), adminReply: safeText(400).optional() }) },
  async ({ admin, params, body, ip, userAgent }) => {
    const id = uuidSchema.safeParse(param(params, "id"));
    if (!id.success) throw notFound();
    const set: Partial<typeof reviews.$inferInsert> = {};
    if (body.isPublished !== undefined) set.isPublished = body.isPublished;
    if (body.adminReply !== undefined) set.adminReply = body.adminReply || null;
    const [r] = await db.update(reviews).set(set).where(eq(reviews.id, id.data)).returning();
    if (!r) throw notFound();
    await audit({ actorType: "ADMIN", actorId: admin!.id, action: "review.update", entityType: "review", entityId: r.id, meta: body, ip, userAgent });
    return { ok: true };
  },
);
