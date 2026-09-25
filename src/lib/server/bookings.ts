import "server-only";
import { and, asc, count, eq, gt, inArray, lt, ne, notInArray, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import {
  blackouts,
  bookingEvents,
  bookings,
  customers,
  promoCodes,
  rewardTransactions,
  vehicles,
  type ActorType,
  type Booking,
  type Customer,
  type Vehicle,
} from "@/db/schema";
import {
  acAllowed,
  computeEstimate,
  computeFinalFare,
  estimatedEngagementMinutes,
  isTripTypeEnabled,
  tierFor,
  type DiscountContext,
  type PromoDiscount,
} from "@/lib/pricing";
import type { SettingsMap } from "@/lib/settings-schema";
import { pricingForVehicle } from "@/lib/vehicle-pricing";
import { addMinutes, calendarDaysSpanned, wallTimeToUtc, zonedParts } from "@/lib/time";
import {
  ACTIVE_STATUSES,
  ENGAGED_STATUSES,
  type BookingStatus,
  type FareBreakdown,
  type FinalFareInput,
  type PaymentMethod,
} from "@/lib/types";
import type { BookingCreateInput, TripRequest } from "@/lib/validation";
import { badRequest, conflict, forbidden, notFound, unprocessable } from "./api";
import { audit } from "./audit";
import { randomCode, randomDigits } from "./crypto";
import { getRoute, verifyPlace, type RouteResult } from "./geo";
import { getSettings } from "./settings";

/* ----------------------------------------------------------------------------
 * Customer loyalty snapshot
 * ------------------------------------------------------------------------- */

export async function completedRideCount(customerId: string, tx: DbOrTx = db) {
  const [row] = await tx
    .select({ n: count() })
    .from(bookings)
    .where(and(eq(bookings.customerId, customerId), eq(bookings.status, "COMPLETED")));
  return Number(row?.n ?? 0);
}

export async function customerLoyalty(customer: Customer, s: SettingsMap, tx: DbOrTx = db) {
  const rides = await completedRideCount(customer.id, tx);
  const tier = tierFor(s.loyalty, rides);
  return { rides, ...tier };
}

/* ----------------------------------------------------------------------------
 * Estimate
 * ------------------------------------------------------------------------- */

export type EstimateResult = {
  fare: FareBreakdown;
  route: RouteResult | null;
  pickupAt: Date;
  returnAt: Date | null;
  estimatedEndAt: Date;
  vehicle: Vehicle;
  availability: { ok: true } | { ok: false; reason: string };
  promo: { code: string; applied: boolean; message: string; promoId?: string } | null;
  referralApplied: boolean;
  tierName: string | null;
  creditsApplied: number;
};

async function activeVehicles(tx: DbOrTx = db) {
  return tx.select().from(vehicles).where(eq(vehicles.isActive, true)).orderBy(asc(vehicles.sortOrder), asc(vehicles.createdAt));
}

async function resolvePromo(
  code: string,
  customer: Customer | null,
  baseAmount: number,
  tx: DbOrTx,
  lock = false,
): Promise<{ ok: true; promo: PromoDiscount; id: string } | { ok: false; message: string }> {
  const q = tx.select().from(promoCodes).where(eq(promoCodes.code, code)).limit(1);
  const [p] = lock ? await q.for("update") : await q;
  const invalid = { ok: false as const, message: "This promo code is invalid or has expired." };
  if (!p || !p.isActive) return invalid;
  const now = new Date();
  if (p.startsAt && p.startsAt > now) return invalid;
  if (p.expiresAt && p.expiresAt < now) return invalid;
  if (p.minFare && baseAmount < p.minFare) {
    return { ok: false, message: `This code applies to fares above ₹${Math.round(p.minFare / 100)}.` };
  }
  const liveStatuses = ["CANCELLED", "REJECTED"] as BookingStatus[];
  if (p.usageLimit) {
    const [u] = await tx
      .select({ n: count() })
      .from(bookings)
      .where(and(eq(bookings.promoCodeId, p.id), notInArray(bookings.status, liveStatuses)));
    if (Number(u?.n ?? 0) >= p.usageLimit) return { ok: false, message: "This promo code has been fully redeemed." };
  }
  if (customer) {
    const [u] = await tx
      .select({ n: count() })
      .from(bookings)
      .where(
        and(eq(bookings.promoCodeId, p.id), eq(bookings.customerId, customer.id), notInArray(bookings.status, liveStatuses)),
      );
    if (Number(u?.n ?? 0) >= p.perCustomerLimit) return { ok: false, message: "You’ve already used this promo code." };
    if (p.firstRideOnly && (await completedRideCount(customer.id, tx)) > 0) {
      return { ok: false, message: "This code is valid on your first ride only." };
    }
  }
  return { ok: true, id: p.id, promo: { code: p.code, type: p.discountType, value: p.value, maxDiscount: p.maxDiscount } };
}

export async function checkAvailability(
  start: Date,
  end: Date,
  s: SettingsMap,
  opts: { excludeBookingId?: string } = {},
  tx: DbOrTx = db,
): Promise<{ ok: true } | { ok: false; reason: string; conflicts: string[] }> {
  const [blk] = await tx
    .select()
    .from(blackouts)
    .where(and(lt(blackouts.startsAt, end), gt(blackouts.endsAt, start)))
    .limit(1);
  if (blk) {
    return { ok: false, reason: "The driver is unavailable on the selected date. Please choose another time.", conflicts: [] };
  }
  const buffer = s.booking.bufferMinutes;
  const clash = await tx
    .select({ code: bookings.code })
    .from(bookings)
    .where(
      and(
        inArray(bookings.status, ENGAGED_STATUSES),
        lt(bookings.pickupAt, addMinutes(end, buffer)),
        gt(bookings.estimatedEndAt, addMinutes(start, -buffer)),
        opts.excludeBookingId ? ne(bookings.id, opts.excludeBookingId) : undefined,
      ),
    )
    .limit(5);
  if (clash.length) {
    return {
      ok: false,
      reason: "The driver is already booked around this time. Please pick a different slot.",
      conflicts: clash.map((c) => c.code),
    };
  }
  return { ok: true };
}

/**
 * Authoritative estimate. Every input is re-validated here; client-side values are
 * never trusted (places are signature-checked, prices recomputed from settings).
 */
export async function estimateTrip(
  input: TripRequest,
  customer: Customer | null,
  tx: DbOrTx = db,
  opts: { lockPromo?: boolean } = {},
): Promise<EstimateResult> {
  const s = await getSettings();
  const tz = s.business.timezone;
  const p = s.pricing;

  if (!isTripTypeEnabled(p, input.tripType)) throw unprocessable("This trip type is not available right now.");
  if (!acAllowed(p, input.isAc)) throw unprocessable(input.isAc ? "AC rides are not available." : "Non-AC rides are not available.");
  if (!verifyPlace(input.pickup)) throw badRequest("Pickup location could not be verified. Please select it again.");
  const needsDrop = input.tripType !== "LOCAL";
  if (needsDrop && !input.drop) throw unprocessable("Please choose a drop location.", { fields: { drop: "Required" } });
  if (input.drop && !verifyPlace(input.drop)) throw badRequest("Drop location could not be verified. Please select it again.");

  // Vehicle
  const list = await activeVehicles(tx);
  if (list.length === 0) throw unprocessable("No vehicles are available right now.");
  const vehicle = (input.vehicleId && list.find((v) => v.id === input.vehicleId)) || list[0];
  if (input.isAc && !vehicle.hasAc) throw unprocessable("The selected vehicle is non-AC only.");
  if (input.passengers > vehicle.seats) {
    throw unprocessable(`The ${vehicle.name} seats up to ${vehicle.seats} passengers.`, { fields: { passengers: "Too many" } });
  }

  // Time window
  let pickupAt: Date;
  let returnAt: Date | null = null;
  try {
    pickupAt = wallTimeToUtc(input.pickupAt, tz);
    if (input.tripType === "ROUND_TRIP") {
      if (!input.returnAt) throw unprocessable("Please choose a return date & time.", { fields: { returnAt: "Required" } });
      returnAt = wallTimeToUtc(input.returnAt, tz);
    }
  } catch (err) {
    if (err instanceof Error && "status" in err) throw err;
    throw badRequest("Invalid date or time.");
  }
  const now = Date.now();
  if (pickupAt.getTime() < now + s.booking.minLeadMinutes * 60_000) {
    const h = Math.round(s.booking.minLeadMinutes / 60);
    throw unprocessable(
      s.booking.minLeadMinutes >= 60
        ? `Please book at least ${h} hour${h > 1 ? "s" : ""} in advance.`
        : `Please book at least ${s.booking.minLeadMinutes} minutes in advance.`,
      { fields: { pickupAt: "Too soon" } },
    );
  }
  if (pickupAt.getTime() > now + s.booking.maxAdvanceDays * 86_400_000) {
    throw unprocessable(`Bookings open up to ${s.booking.maxAdvanceDays} days in advance.`, { fields: { pickupAt: "Too far" } });
  }
  if (returnAt && returnAt.getTime() <= pickupAt.getTime() + 60 * 60_000) {
    throw unprocessable("Return must be at least an hour after pickup.", { fields: { returnAt: "Too early" } });
  }
  if (returnAt && returnAt.getTime() - pickupAt.getTime() > 30 * 86_400_000) {
    throw unprocessable("Round trips can be up to 30 days long.", { fields: { returnAt: "Too long" } });
  }

  // Route
  let route: RouteResult | null = null;
  if (input.drop) {
    route = await getRoute(input.pickup, input.drop);
    if (route.distanceMeters < 300 && input.tripType !== "LOCAL") {
      throw unprocessable("Pickup and drop look like the same place. Please check the locations.");
    }
    if (route.distanceMeters > 3_000_000) throw unprocessable("That trip is too long for online booking — please call us.");
  }
  const oneWayKm = (route?.distanceMeters ?? 0) / 1000;
  const durationMin = (route?.durationSeconds ?? 0) / 60;
  const days = returnAt ? calendarDaysSpanned(pickupAt, returnAt, tz) : 1;
  // The vehicle's own rate card (overrides + multiplier) drives every price below.
  const vp = pricingForVehicle(p, vehicle);
  const pkg = input.tripType === "LOCAL" ? (vp.local.packages.find((x) => x.id === input.localPackageId) ?? vp.local.packages[0]) : null;

  // Discounts
  const ctx: DiscountContext = {};
  let tierName: string | null = null;
  if (customer && s.loyalty.enabled) {
    const loyalty = await customerLoyalty(customer, s, tx);
    tierName = loyalty.current.name;
    if (loyalty.current.discountPercent > 0) {
      ctx.tier = { name: loyalty.current.name, percent: loyalty.current.discountPercent, cap: s.loyalty.maxTierDiscount };
    }
  }
  const fareInput = {
    tripType: input.tripType,
    isAc: input.isAc,
    multiplierPct: 100,
    km: input.tripType === "ROUND_TRIP" ? oneWayKm * 2 : oneWayKm,
    durationMin,
    pickupHour: zonedParts(pickupAt, tz).hour,
    days,
    localPackageId: pkg?.id,
  };

  let promo: EstimateResult["promo"] = null;
  if (input.promoCode) {
    const baseOnly = computeEstimate(vp, fareInput, {});
    const r = await resolvePromo(input.promoCode, customer, baseOnly.subtotal, tx, opts.lockPromo);
    if (r.ok) {
      ctx.promo = r.promo;
      promo = { code: r.promo.code, applied: true, message: "Promo applied", promoId: r.id };
    } else {
      promo = { code: input.promoCode, applied: false, message: r.message };
    }
  }

  let referralApplied = false;
  if (!ctx.promo && customer?.referredById && s.loyalty.referral.enabled) {
    const priorBookings = await tx
      .select({ n: count() })
      .from(bookings)
      .where(and(eq(bookings.customerId, customer.id), notInArray(bookings.status, ["CANCELLED", "REJECTED"])));
    if (Number(priorBookings[0]?.n ?? 0) === 0) {
      ctx.referral = { amount: s.loyalty.referral.refereeDiscount };
      referralApplied = true;
    }
  }

  if (input.useCredits && customer && customer.rewardBalance > 0 && s.loyalty.enabled) {
    ctx.credits = { available: customer.rewardBalance, maxPercent: s.loyalty.maxRedeemPercent };
  }

  const fare = computeEstimate(vp, fareInput, ctx);
  const creditsApplied = fare.discounts.find((d) => d.key === "credits")?.amount ?? 0;

  // Single-driver availability
  const engagement = estimatedEngagementMinutes(input.tripType, durationMin, {
    returnGapMin: returnAt ? (returnAt.getTime() - pickupAt.getTime()) / 60000 : 0,
    localHours: pkg?.hours,
  });
  const estimatedEndAt = addMinutes(pickupAt, engagement);
  const avail = s.booking.blockOverlaps ? await checkAvailability(pickupAt, estimatedEndAt, s, {}, tx) : ({ ok: true } as const);

  return {
    fare,
    route,
    pickupAt,
    returnAt,
    estimatedEndAt,
    vehicle,
    availability: avail.ok ? { ok: true } : { ok: false, reason: avail.reason },
    promo,
    referralApplied,
    tierName,
    creditsApplied,
  };
}

/* ----------------------------------------------------------------------------
 * Create
 * ------------------------------------------------------------------------- */

export async function createBooking(
  input: BookingCreateInput,
  customer: Customer,
  meta: { ip: string; userAgent: string; source?: "WEB" | "ADMIN"; actor?: ActorType; actorId?: string },
): Promise<{ booking: Booking; conflicts: string[] }> {
  const s = await getSettings();
  if (!s.booking.acceptingBookings && meta.source !== "ADMIN") throw unprocessable(s.booking.pausedMessage);
  if (customer.status === "BLOCKED") throw forbidden("Your account cannot make bookings. Please contact support.");

  const result = await db.transaction(async (tx) => {
    // Serialise bookings per customer to enforce the active-booking cap reliably.
    const [fresh] = await tx.select().from(customers).where(eq(customers.id, customer.id)).for("update");
    const [active] = await tx
      .select({ n: count() })
      .from(bookings)
      .where(and(eq(bookings.customerId, customer.id), inArray(bookings.status, ACTIVE_STATUSES)));
    if (meta.source !== "ADMIN" && Number(active?.n ?? 0) >= s.booking.maxActiveBookingsPerCustomer) {
      throw conflict(
        `You already have ${active?.n} upcoming rides. Please complete or cancel one before booking another.`,
      );
    }

    const est = await estimateTrip(input, fresh, tx, { lockPromo: true });
    if (!est.availability.ok && meta.source !== "ADMIN") throw conflict(est.availability.reason);
    if (input.promoCode && est.promo && !est.promo.applied) throw unprocessable(est.promo.message, { fields: { promoCode: est.promo.message } });

    let code = "";
    for (let i = 0; i < 5; i++) {
      const candidate = `${s.business.bookingPrefix}-${randomCode(6)}`;
      const [exists] = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.code, candidate)).limit(1);
      if (!exists) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("Could not allocate a booking code");

    const [created] = await tx
      .insert(bookings)
      .values({
        code,
        customerId: fresh.id,
        status: s.booking.autoConfirm && est.availability.ok ? "CONFIRMED" : "PENDING",
        tripType: input.tripType,
        vehicleId: est.vehicle.id,
        vehicleName: est.vehicle.model ? `${est.vehicle.name} (${est.vehicle.model})` : est.vehicle.name,
        isAc: input.isAc,
        passengers: input.passengers,
        pickupAddress: input.pickup.label,
        pickupLat: input.pickup.lat,
        pickupLng: input.pickup.lng,
        dropAddress: input.drop?.label ?? null,
        dropLat: input.drop?.lat ?? null,
        dropLng: input.drop?.lng ?? null,
        pickupAt: est.pickupAt,
        returnAt: est.returnAt,
        estimatedEndAt: est.estimatedEndAt,
        localPackage: input.tripType === "LOCAL" ? (input.localPackageId ?? s.pricing.local.packages[0].id) : null,
        distanceMeters: est.route?.distanceMeters ?? null,
        durationSeconds: est.route?.durationSeconds ?? null,
        routeSource: est.route?.source ?? null,
        contactName: input.contact.name,
        contactPhone: input.contact.phone,
        contactEmail: input.contact.email,
        customerNote: input.note || null,
        fareEstimate: est.fare.total,
        fareBreakdown: est.fare,
        discountTotal: est.fare.discountTotal,
        promoCodeId: est.promo?.applied ? (est.promo.promoId ?? null) : null,
        promoCode: est.promo?.applied ? est.promo.code : null,
        referralApplied: est.referralApplied,
        rewardRedeemed: est.creditsApplied,
        loyaltyTier: est.tierName,
        ridePin: randomDigits(4),
        source: meta.source ?? "WEB",
        clientIp: meta.ip,
        userAgent: meta.userAgent,
        confirmedAt: s.booking.autoConfirm && est.availability.ok ? new Date() : null,
      })
      .returning();

    if (est.creditsApplied > 0) {
      await tx
        .update(customers)
        .set({ rewardBalance: sql`${customers.rewardBalance} - ${est.creditsApplied}` })
        .where(eq(customers.id, fresh.id));
      await tx.insert(rewardTransactions).values({
        customerId: fresh.id,
        bookingId: created.id,
        type: "REDEEM",
        amount: -est.creditsApplied,
        note: `Redeemed on ${code}`,
      });
    }

    // Keep the profile phone fresh for convenience (identity remains the verified email).
    if (!fresh.phone) await tx.update(customers).set({ phone: input.contact.phone }).where(eq(customers.id, fresh.id));

    await tx.insert(bookingEvents).values({
      bookingId: created.id,
      type: "CREATED",
      toStatus: created.status,
      actor: meta.actor ?? "CUSTOMER",
      actorId: meta.actorId ?? fresh.id,
      message: meta.source === "ADMIN" ? "Booking created by the driver" : "Booking requested",
    });

    let conflicts: string[] = [];
    if (!est.availability.ok) {
      const again = await checkAvailability(est.pickupAt, est.estimatedEndAt, s, { excludeBookingId: created.id }, tx);
      if (!again.ok) conflicts = again.conflicts;
    }
    return { booking: created, conflicts };
  });

  await audit({
    actorType: meta.actor ?? "CUSTOMER",
    actorId: meta.actorId ?? customer.id,
    action: "booking.create",
    entityType: "booking",
    entityId: result.booking.id,
    meta: { code: result.booking.code, tripType: result.booking.tripType, source: meta.source ?? "WEB" },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return result;
}

/* ----------------------------------------------------------------------------
 * Status machine
 * ------------------------------------------------------------------------- */

export const ADMIN_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["EN_ROUTE", "ARRIVED", "IN_PROGRESS", "CANCELLED"],
  EN_ROUTE: ["ARRIVED", "IN_PROGRESS", "CANCELLED"],
  ARRIVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

const TIMESTAMP_FOR: Partial<Record<BookingStatus, keyof Booking>> = {
  CONFIRMED: "confirmedAt",
  EN_ROUTE: "enRouteAt",
  ARRIVED: "arrivedAt",
  IN_PROGRESS: "startedAt",
  COMPLETED: "completedAt",
  CANCELLED: "cancelledAt",
  REJECTED: "cancelledAt",
};

export const STATUS_EVENT_MESSAGE: Record<BookingStatus, string> = {
  PENDING: "Booking requested",
  CONFIRMED: "Ride confirmed by the driver",
  EN_ROUTE: "Driver is on the way",
  ARRIVED: "Driver arrived at pickup",
  IN_PROGRESS: "Trip started",
  COMPLETED: "Trip completed",
  CANCELLED: "Booking cancelled",
  REJECTED: "Booking declined",
};

type TransitionOpts = {
  actor: ActorType;
  actorId?: string | null;
  reason?: string;
  set?: Partial<typeof bookings.$inferInsert>;
  message?: string;
  meta?: Record<string, unknown>;
};

/**
 * Atomic, race-safe status change: the UPDATE only succeeds if the booking is still
 * in the expected state, so double-taps / concurrent Telegram + web actions are safe.
 */
export async function transitionBooking(
  bookingId: string,
  from: BookingStatus,
  to: BookingStatus,
  opts: TransitionOpts,
  tx: DbOrTx = db,
): Promise<Booking> {
  const stamp = TIMESTAMP_FOR[to];
  const set: Record<string, unknown> = { ...opts.set, status: to };
  if (stamp) set[stamp] = new Date();
  if (to === "CANCELLED" || to === "REJECTED") {
    set.cancelledBy = opts.actor;
    set.cancelReason = opts.reason ?? null;
  }
  const [updated] = await tx
    .update(bookings)
    .set(set)
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, from)))
    .returning();
  if (!updated) throw conflict("This booking was updated elsewhere. Please refresh and try again.");

  await tx.insert(bookingEvents).values({
    bookingId,
    type: "STATUS",
    fromStatus: from,
    toStatus: to,
    actor: opts.actor,
    actorId: opts.actorId ?? null,
    message: opts.message ?? (opts.reason ? `${STATUS_EVENT_MESSAGE[to]} — ${opts.reason}` : STATUS_EVENT_MESSAGE[to]),
    meta: opts.meta,
  });

  if ((to === "CANCELLED" || to === "REJECTED") && updated.rewardRedeemed > 0) {
    await refundCredits(updated, tx);
  }
  return updated;
}

async function refundCredits(b: Booking, tx: DbOrTx) {
  const [already] = await tx
    .select({ n: count() })
    .from(rewardTransactions)
    .where(and(eq(rewardTransactions.bookingId, b.id), eq(rewardTransactions.type, "REFUND")));
  if (Number(already?.n ?? 0) > 0) return;
  await tx
    .update(customers)
    .set({ rewardBalance: sql`${customers.rewardBalance} + ${b.rewardRedeemed}` })
    .where(eq(customers.id, b.customerId));
  await tx.insert(rewardTransactions).values({
    customerId: b.customerId,
    bookingId: b.id,
    type: "REFUND",
    amount: b.rewardRedeemed,
    note: `Refund for ${b.code}`,
  });
}

export async function getBookingOrThrow(id: string, tx: DbOrTx = db) {
  const [b] = await tx.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!b) throw notFound("Booking not found.");
  return b;
}

/** Customer-initiated cancellation, subject to the cancellation policy. */
export function canCustomerCancel(b: Booking, s: SettingsMap): { ok: boolean; reason?: string } {
  if (!["PENDING", "CONFIRMED"].includes(b.status)) {
    return { ok: false, reason: "This booking can no longer be cancelled online. Please call the driver." };
  }
  if (b.status === "CONFIRMED") {
    const cutoff = b.pickupAt.getTime() - s.booking.customerCancelCutoffMinutes * 60_000;
    if (Date.now() > cutoff) {
      return { ok: false, reason: "It’s too close to pickup to cancel online. Please call the driver." };
    }
  }
  return { ok: true };
}

/* ----------------------------------------------------------------------------
 * Final fare & payments
 * ------------------------------------------------------------------------- */

export async function computeFinalFareFor(b: Booking, input: FinalFareInput) {
  const s = await getSettings();
  const [v] = b.vehicleId ? await db.select().from(vehicles).where(eq(vehicles.id, b.vehicleId)).limit(1) : [];
  return computeFinalFare(
    v ? pricingForVehicle(s.pricing, v) : s.pricing,
    {
      tripType: b.tripType,
      isAc: b.isAc,
      multiplierPct: 100,
      durationMin: (b.durationSeconds ?? 0) / 60,
      pickupHour: zonedParts(b.pickupAt, s.business.timezone).hour,
      localPackageId: b.localPackage,
      estimate: b.fareBreakdown,
    },
    input,
  );
}

export async function markPaid(
  b: Booking,
  opts: { method: PaymentMethod; reference?: string | null; actor: ActorType; actorId?: string | null; waived?: boolean },
  tx: DbOrTx = db,
): Promise<Booking> {
  if (b.status !== "COMPLETED") throw unprocessable("Complete the trip before recording payment.");
  if (b.paymentStatus === "PAID" || b.paymentStatus === "WAIVED") throw conflict("Payment is already recorded.");
  const [updated] = await tx
    .update(bookings)
    .set({
      paymentStatus: opts.waived ? "WAIVED" : "PAID",
      paymentMethod: opts.method,
      paymentReference: opts.reference ?? b.paymentReference,
      paidAt: new Date(),
    })
    .where(and(eq(bookings.id, b.id), inArray(bookings.paymentStatus, ["UNPAID", "CLAIMED"])))
    .returning();
  if (!updated) throw conflict("Payment status changed elsewhere. Please refresh.");
  await tx.insert(bookingEvents).values({
    bookingId: b.id,
    type: "PAYMENT",
    actor: opts.actor,
    actorId: opts.actorId ?? null,
    message: opts.waived ? "Fare waived" : `Payment received via ${opts.method}`,
    meta: { method: opts.method },
  });
  if (!opts.waived) await maybeAwardReferral(updated, tx);
  return updated;
}

/** When a referred customer's first ride is paid, credit the referrer once. */
async function maybeAwardReferral(b: Booking, tx: DbOrTx) {
  const s = await getSettings();
  if (!s.loyalty.enabled || !s.loyalty.referral.enabled || s.loyalty.referral.referrerBonus <= 0) return;
  const [c] = await tx.select().from(customers).where(eq(customers.id, b.customerId)).limit(1);
  if (!c?.referredById) return;
  const [paidBefore] = await tx
    .select({ n: count() })
    .from(bookings)
    .where(and(eq(bookings.customerId, c.id), eq(bookings.paymentStatus, "PAID"), ne(bookings.id, b.id)));
  if (Number(paidBefore?.n ?? 0) > 0) return;
  const [already] = await tx
    .select({ n: count() })
    .from(rewardTransactions)
    .where(and(eq(rewardTransactions.customerId, c.referredById), eq(rewardTransactions.bookingId, b.id)));
  if (Number(already?.n ?? 0) > 0) return;
  await tx
    .update(customers)
    .set({ rewardBalance: sql`${customers.rewardBalance} + ${s.loyalty.referral.referrerBonus}` })
    .where(eq(customers.id, c.referredById));
  await tx.insert(rewardTransactions).values({
    customerId: c.referredById,
    bookingId: b.id,
    type: "REFERRAL_BONUS",
    amount: s.loyalty.referral.referrerBonus,
    note: `${c.name.split(" ")[0]} completed their first ride`,
  });
}

/* ----------------------------------------------------------------------------
 * Conflicts for the admin view
 * ------------------------------------------------------------------------- */

export async function conflictsFor(b: Booking) {
  const s = await getSettings();
  const buffer = s.booking.bufferMinutes;
  return db
    .select({ id: bookings.id, code: bookings.code, pickupAt: bookings.pickupAt, status: bookings.status })
    .from(bookings)
    .where(
      and(
        ne(bookings.id, b.id),
        inArray(bookings.status, ENGAGED_STATUSES),
        lt(bookings.pickupAt, addMinutes(b.estimatedEndAt, buffer)),
        gt(bookings.estimatedEndAt, addMinutes(b.pickupAt, -buffer)),
      ),
    )
    .limit(5);
}
