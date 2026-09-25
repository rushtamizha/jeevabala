import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookingEvents, bookings } from "@/db/schema";
import { conflict, param, route, unprocessable } from "@/lib/server/api";
import { getOwnBooking } from "@/lib/server/customer-bookings";
import { notifyBooking } from "@/lib/server/notify";
import { utrSchema } from "@/lib/validation";

/** Customer reports a manual payment (UPI/cash). The driver verifies and marks it paid. */
export const POST = route(
  {
    auth: "customer",
    body: z.object({ method: z.enum(["UPI", "CASH"]), reference: utrSchema.optional() }),
    rateLimit: [{ name: "payclaim", limit: 10, windowSec: 3600, by: "customer" }],
  },
  async ({ customer, params, body }) => {
    const b = await getOwnBooking(customer!.id, param(params, "code"));
    if (b.status !== "COMPLETED" || b.finalFare === null) throw unprocessable("Payment opens once your trip is completed.");
    if (b.paymentStatus !== "UNPAID") throw conflict("Payment has already been reported for this trip.");
    const [updated] = await db
      .update(bookings)
      .set({ paymentStatus: "CLAIMED", paymentMethod: body.method, paymentReference: body.reference || null, paymentClaimedAt: new Date() })
      .where(and(eq(bookings.id, b.id), eq(bookings.paymentStatus, "UNPAID")))
      .returning();
    if (!updated) throw conflict("Payment status changed. Please refresh.");
    await db.insert(bookingEvents).values({
      bookingId: b.id,
      type: "PAYMENT",
      actor: "CUSTOMER",
      actorId: customer!.id,
      message: body.method === "UPI" ? "Customer reported UPI payment" : "Customer paid in cash",
      meta: { method: body.method, hasReference: Boolean(body.reference) },
    });
    await notifyBooking("payment.claimed", b.id);
    return { paymentStatus: updated.paymentStatus };
  },
);
