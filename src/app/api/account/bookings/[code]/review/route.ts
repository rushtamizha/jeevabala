import { z } from "zod";
import { db } from "@/db";
import { bookingEvents, reviews } from "@/db/schema";
import { conflict, param, route, unprocessable } from "@/lib/server/api";
import { getOwnBooking } from "@/lib/server/customer-bookings";
import { notifyBooking } from "@/lib/server/notify";
import { safeText } from "@/lib/validation";

export const POST = route(
  {
    auth: "customer",
    body: z.object({ rating: z.number().int().min(1).max(5), comment: safeText(600).optional() }),
    rateLimit: [{ name: "review", limit: 10, windowSec: 3600, by: "customer" }],
  },
  async ({ customer, params, body }) => {
    const b = await getOwnBooking(customer!.id, param(params, "code"));
    if (b.status !== "COMPLETED") throw unprocessable("You can rate a trip once it’s completed.");
    const [created] = await db
      .insert(reviews)
      .values({ bookingId: b.id, customerId: customer!.id, rating: body.rating, comment: body.comment || null })
      .onConflictDoNothing({ target: reviews.bookingId })
      .returning();
    if (!created) throw conflict("You’ve already rated this trip. Thank you!");
    await db.insert(bookingEvents).values({
      bookingId: b.id,
      type: "REVIEW",
      actor: "CUSTOMER",
      actorId: customer!.id,
      message: `Rated ${body.rating}★`,
      visibleToCustomer: false,
    });
    await notifyBooking("review.created", b.id, { rating: body.rating, comment: body.comment });
    return { ok: true };
  },
);
