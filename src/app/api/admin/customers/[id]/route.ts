import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customers, rewardTransactions, sessions } from "@/db/schema";
import { notFound, param, route, unprocessable } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { safeText, uuidSchema } from "@/lib/validation";

export const PATCH = route(
  {
    auth: "admin",
    body: z.object({
      status: z.enum(["ACTIVE", "BLOCKED"]).optional(),
      adminNote: safeText(2000).optional(),
      creditAdjustment: z.number().int().min(-10_000_000).max(10_000_000).optional(),
      creditNote: safeText(120).optional(),
    }),
  },
  async ({ admin, params, body, ip, userAgent }) => {
    const id = uuidSchema.safeParse(param(params, "id"));
    if (!id.success) throw notFound();
    const [c] = await db.select().from(customers).where(eq(customers.id, id.data)).limit(1);
    if (!c) throw notFound();
    await db.transaction(async (tx) => {
      const set: Partial<typeof customers.$inferInsert> = {};
      if (body.status) set.status = body.status;
      if (body.adminNote !== undefined) set.adminNote = body.adminNote || null;
      if (Object.keys(set).length) await tx.update(customers).set(set).where(eq(customers.id, c.id));
      if (body.status === "BLOCKED") await tx.delete(sessions).where(eq(sessions.customerId, c.id));
      if (body.creditAdjustment) {
        if (c.rewardBalance + body.creditAdjustment < 0) throw unprocessable("Credit balance can’t go below zero.");
        await tx
          .update(customers)
          .set({ rewardBalance: sql`${customers.rewardBalance} + ${body.creditAdjustment}` })
          .where(eq(customers.id, c.id));
        await tx.insert(rewardTransactions).values({
          customerId: c.id,
          type: "ADJUSTMENT",
          amount: body.creditAdjustment,
          note: body.creditNote || "Adjusted by driver",
        });
      }
    });
    await audit({ actorType: "ADMIN", actorId: admin!.id, action: "customer.update", entityType: "customer", entityId: c.id, meta: { status: body.status, credit: body.creditAdjustment }, ip, userAgent });
    return { ok: true };
  },
);
