import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookingEvents, bookings, type ActorType, type Booking } from "@/db/schema";
import { PAYMENT_METHODS } from "@/lib/types";
import { safeText, utrSchema } from "@/lib/validation";
import { ApiError, conflict, unprocessable } from "./api";
import { audit } from "./audit";
import { computeFinalFareFor, getBookingOrThrow, markPaid, transitionBooking } from "./bookings";
import { safeEqual } from "./crypto";
import { notifyBooking, type NotifyEvent } from "./notify";
import { rateLimit } from "./rate-limit";
import { getSettings } from "./settings";

const money = z.number().int().min(0).max(100_000_000);

export const finalFareInputSchema = z.object({
  actualKm: z.number().min(0).max(10_000).optional(),
  actualHours: z.number().min(0).max(720).optional(),
  days: z.number().int().min(1).max(60).optional(),
  tolls: money.optional(),
  parking: money.optional(),
  permit: money.optional(),
  waiting: money.optional(),
  other: money.optional(),
  otherLabel: safeText(40).optional(),
  extraDiscount: money.optional(),
  overrideTotal: money.optional(),
});

export const adminActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), quotedFare: money.optional(), message: safeText(200).optional() }),
  z.object({ action: z.literal("reject"), reason: safeText(200, 3) }),
  z.object({ action: z.literal("en_route") }),
  z.object({ action: z.literal("arrived") }),
  z.object({ action: z.literal("start"), pin: z.string().regex(/^\d{4}$/).optional(), skipPin: z.boolean().optional() }),
  z.object({ action: z.literal("complete"), fare: finalFareInputSchema }),
  z.object({ action: z.literal("update_fare"), fare: finalFareInputSchema }),
  z.object({ action: z.literal("cancel"), reason: safeText(200, 3) }),
  z.object({
    action: z.literal("payment"),
    method: z.enum(PAYMENT_METHODS),
    reference: utrSchema.optional(),
    waived: z.boolean().optional(),
  }),
  z.object({ action: z.literal("reject_claim"), reason: safeText(200).optional() }),
  z.object({ action: z.literal("note"), adminNote: safeText(2000) }),
]);

export type AdminAction = z.infer<typeof adminActionSchema>;

type Actor = { type: ActorType; id: string | null; ip?: string; userAgent?: string };

/**
 * Single entry point for every driver/admin operation on a booking – used by the web
 * dashboard and the Telegram bot alike, so rules are enforced identically.
 */
export async function performAdminAction(bookingId: string, input: AdminAction, actor: Actor): Promise<Booking> {
  const b = await getBookingOrThrow(bookingId);
  const s = await getSettings();
  let updated: Booking;
  let notify: NotifyEvent | null = null;
  let notifyExtra: Parameters<typeof notifyBooking>[2] = {};
  const base = { actor: actor.type, actorId: actor.id };

  switch (input.action) {
    case "accept": {
      if (b.status !== "PENDING") throw conflict(`This booking is already ${b.status.toLowerCase().replace("_", " ")}.`);
      updated = await transitionBooking(b.id, "PENDING", "CONFIRMED", {
        ...base,
        set: input.quotedFare ? { quotedFare: input.quotedFare } : undefined,
        message: input.message ? `Ride confirmed — ${input.message}` : undefined,
      });
      notify = "booking.confirmed";
      break;
    }
    case "reject": {
      if (b.status !== "PENDING") throw conflict("Only pending requests can be declined.");
      updated = await transitionBooking(b.id, "PENDING", "REJECTED", { ...base, reason: input.reason });
      notify = "booking.rejected";
      break;
    }
    case "en_route": {
      if (b.status !== "CONFIRMED") throw conflict("Confirm the booking first.");
      updated = await transitionBooking(b.id, "CONFIRMED", "EN_ROUTE", base);
      notify = "driver.en_route";
      break;
    }
    case "arrived": {
      if (b.status !== "CONFIRMED" && b.status !== "EN_ROUTE") throw conflict("Invalid step for this booking.");
      updated = await transitionBooking(b.id, b.status, "ARRIVED", base);
      notify = "driver.arrived";
      break;
    }
    case "start": {
      if (!["CONFIRMED", "EN_ROUTE", "ARRIVED"].includes(b.status)) throw conflict("This trip can’t be started now.");
      const skip = input.skipPin === true || !s.booking.requireRidePin;
      if (!skip) {
        const limiter = await rateLimit(`ridepin:${b.id}`, 6, 600);
        if (!limiter.ok) throw new ApiError(429, "Too many wrong PIN attempts. Wait a few minutes.", "rate_limited");
        if (!input.pin || !safeEqual(input.pin, b.ridePin)) {
          throw new ApiError(400, "Ride PIN doesn’t match. Ask the customer for the 4-digit PIN.", "invalid_pin", {
            fields: { pin: "Incorrect PIN" },
          });
        }
      }
      updated = await transitionBooking(b.id, b.status, "IN_PROGRESS", {
        ...base,
        meta: { pinVerified: !skip },
        message: skip && s.booking.requireRidePin ? "Trip started (PIN skipped by driver)" : undefined,
      });
      notify = "trip.started";
      break;
    }
    case "complete": {
      if (b.status !== "IN_PROGRESS") throw conflict("Start the trip before completing it.");
      const fare = await computeFinalFareFor(b, input.fare);
      updated = await transitionBooking(b.id, "IN_PROGRESS", "COMPLETED", {
        ...base,
        set: { finalFare: fare.amountDue, finalBreakdown: fare, paymentStatus: fare.amountDue === 0 ? "PAID" : "UNPAID" },
        meta: { finalFare: fare.amountDue },
      });
      notify = "trip.completed";
      break;
    }
    case "update_fare": {
      if (b.status !== "COMPLETED" || !["UNPAID", "CLAIMED"].includes(b.paymentStatus)) {
        throw unprocessable("The fare can only be edited on completed, unpaid trips.");
      }
      const fare = await computeFinalFareFor(b, input.fare);
      const [row] = await db
        .update(bookings)
        .set({ finalFare: fare.amountDue, finalBreakdown: fare })
        .where(and(eq(bookings.id, b.id), eq(bookings.status, "COMPLETED")))
        .returning();
      updated = row;
      await db.insert(bookingEvents).values({
        bookingId: b.id,
        type: "FARE",
        actor: actor.type,
        actorId: actor.id,
        message: "Final fare updated",
        meta: { from: b.finalFare, to: fare.amountDue },
      });
      notify = "trip.completed";
      break;
    }
    case "cancel": {
      if (!["PENDING", "CONFIRMED", "EN_ROUTE", "ARRIVED"].includes(b.status)) throw conflict("This booking can’t be cancelled.");
      updated = await transitionBooking(b.id, b.status, "CANCELLED", { ...base, reason: input.reason });
      notify = "booking.cancelled";
      notifyExtra = { cancelledBy: "ADMIN", reason: input.reason };
      break;
    }
    case "payment": {
      updated = await markPaid(b, {
        method: input.method,
        reference: input.reference,
        waived: input.waived,
        actor: actor.type,
        actorId: actor.id,
      });
      notify = input.waived ? null : "payment.received";
      break;
    }
    case "reject_claim": {
      if (b.paymentStatus !== "CLAIMED") throw conflict("There is no payment claim to reject.");
      const [row] = await db
        .update(bookings)
        .set({ paymentStatus: "UNPAID", paymentClaimedAt: null })
        .where(and(eq(bookings.id, b.id), eq(bookings.paymentStatus, "CLAIMED")))
        .returning();
      if (!row) throw conflict("Payment status changed. Please refresh.");
      updated = row;
      await db.insert(bookingEvents).values({
        bookingId: b.id,
        type: "PAYMENT",
        actor: actor.type,
        actorId: actor.id,
        message: `Payment not received yet${input.reason ? ` — ${input.reason}` : ""}. Please try again.`,
      });
      break;
    }
    case "note": {
      const [row] = await db.update(bookings).set({ adminNote: input.adminNote || null }).where(eq(bookings.id, b.id)).returning();
      updated = row;
      break;
    }
  }

  await audit({
    actorType: actor.type,
    actorId: actor.id,
    action: `booking.${input.action}`,
    entityType: "booking",
    entityId: b.id,
    meta: { code: b.code, from: b.status, to: updated.status },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  if (notify) await notifyBooking(notify, b.id, notifyExtra);
  return updated;
}
