import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings, customers, reviews, savedPlaces, sessions } from "@/db/schema";
import { route, unprocessable } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { clearSessionCookie } from "@/lib/server/session";
import { ACTIVE_STATUSES } from "@/lib/types";

/** Right to erasure: anonymise personal data while keeping financial records intact. */
export const POST = route(
  {
    auth: "customer",
    body: z.object({ confirm: z.literal("DELETE") }),
    rateLimit: [{ name: "acctdel", limit: 3, windowSec: 3600, by: "customer" }],
  },
  async ({ customer, ip, userAgent }) => {
    const c = customer!;
    const [active] = await db
      .select({ n: count() })
      .from(bookings)
      .where(and(eq(bookings.customerId, c.id), inArray(bookings.status, ACTIVE_STATUSES)));
    if (Number(active?.n ?? 0) > 0) throw unprocessable("Please complete or cancel your upcoming rides first.");
    await db.transaction(async (tx) => {
      await tx
        .update(customers)
        .set({
          name: "Deleted user",
          email: `deleted+${c.id}@invalid.local`,
          phone: null,
          adminNote: null,
          marketingOptIn: false,
          whatsappOptIn: false,
          rewardBalance: 0,
          deletedAt: new Date(),
        })
        .where(eq(customers.id, c.id));
      await tx
        .update(bookings)
        .set({ contactName: "Deleted user", contactPhone: "", contactEmail: "", customerNote: null, clientIp: null, userAgent: null })
        .where(eq(bookings.customerId, c.id));
      await tx.update(reviews).set({ comment: null, isPublished: false }).where(eq(reviews.customerId, c.id));
      await tx.delete(savedPlaces).where(eq(savedPlaces.customerId, c.id));
      await tx.delete(sessions).where(eq(sessions.customerId, c.id));
    });
    await clearSessionCookie("CUSTOMER");
    await audit({ actorType: "CUSTOMER", actorId: c.id, action: "customer.delete_account", ip, userAgent });
    return { ok: true };
  },
);
