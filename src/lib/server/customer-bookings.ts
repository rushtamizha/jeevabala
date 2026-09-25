import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingEvents, bookings, reviews, vehicles, type Booking } from "@/db/schema";
import { upiUri } from "@/lib/upi";
import { notFound } from "./api";
import { canCustomerCancel } from "./bookings";
import { qrPath } from "./qr";
import { getSettings } from "./settings";

const CODE_RE = /^[A-Z]{2,4}-[2-9A-HJKMNP-TV-Z]{6}$/;

/** Ownership-scoped lookup: a booking is only ever resolved together with its owner id (no IDOR). */
export async function getOwnBooking(customerId: string, code: string): Promise<Booking> {
  const normalized = code.toUpperCase();
  if (!CODE_RE.test(normalized)) throw notFound("Booking not found.");
  const [b] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.code, normalized), eq(bookings.customerId, customerId)))
    .limit(1);
  if (!b) throw notFound("Booking not found.");
  return b;
}

const DRIVER_VISIBLE = new Set(["CONFIRMED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED"]);
const PIN_VISIBLE = new Set(["CONFIRMED", "EN_ROUTE", "ARRIVED"]);

/** Everything the customer dashboard needs – and nothing internal (IP, admin notes…). */
export async function customerBookingDetail(customerId: string, code: string) {
  const b = await getOwnBooking(customerId, code);
  const s = await getSettings();
  const [events, [review], [vehicle]] = await Promise.all([
    db
      .select({
        id: bookingEvents.id,
        type: bookingEvents.type,
        toStatus: bookingEvents.toStatus,
        message: bookingEvents.message,
        createdAt: bookingEvents.createdAt,
      })
      .from(bookingEvents)
      .where(and(eq(bookingEvents.bookingId, b.id), eq(bookingEvents.visibleToCustomer, true)))
      .orderBy(asc(bookingEvents.createdAt)),
    db.select().from(reviews).where(eq(reviews.bookingId, b.id)).limit(1),
    b.vehicleId ? db.select().from(vehicles).where(eq(vehicles.id, b.vehicleId)).limit(1) : Promise.resolve([]),
  ]);

  const amountDue = b.finalFare ?? null;
  const paymentOpen = b.status === "COMPLETED" && amountDue !== null && (b.paymentStatus === "UNPAID" || b.paymentStatus === "CLAIMED");
  const upiReady = s.payment.upiEnabled && Boolean(s.payment.upiId);
  const upi =
    paymentOpen && upiReady && amountDue > 0
      ? (() => {
          const params = {
            vpa: s.payment.upiId,
            name: s.payment.payeeName || s.business.name,
            amountPaise: amountDue,
            note: `${s.business.name} ${b.code}`,
          };
          const uri = upiUri(params);
          return { ...params, uri, qr: qrPath(uri) };
        })()
      : null;
  const showDriver = DRIVER_VISIBLE.has(b.status);
  const pkg = b.localPackage ? s.pricing.local.packages.find((p) => p.id === b.localPackage) : null;

  return {
    booking: {
      id: b.id,
      code: b.code,
      status: b.status,
      tripType: b.tripType,
      vehicleName: b.vehicleName,
      isAc: b.isAc,
      passengers: b.passengers,
      pickupAddress: b.pickupAddress,
      pickupLat: b.pickupLat,
      pickupLng: b.pickupLng,
      dropAddress: b.dropAddress,
      dropLat: b.dropLat,
      dropLng: b.dropLng,
      pickupAt: b.pickupAt.toISOString(),
      returnAt: b.returnAt?.toISOString() ?? null,
      packageLabel: pkg?.label ?? null,
      distanceKm: b.distanceMeters ? Math.round(b.distanceMeters / 100) / 10 : null,
      durationMin: b.durationSeconds ? Math.round(b.durationSeconds / 60) : null,
      contactName: b.contactName,
      contactPhone: b.contactPhone,
      customerNote: b.customerNote,
      fareEstimate: b.fareEstimate,
      fareBreakdown: b.fareBreakdown,
      quotedFare: b.quotedFare,
      finalFare: b.finalFare,
      finalBreakdown: b.finalBreakdown,
      paymentStatus: b.paymentStatus,
      paymentMethod: b.paymentMethod,
      paymentReference: b.paymentReference,
      paidAt: b.paidAt?.toISOString() ?? null,
      ridePin: PIN_VISIBLE.has(b.status) ? b.ridePin : null,
      cancelReason: b.status === "CANCELLED" || b.status === "REJECTED" ? b.cancelReason : null,
      cancelledBy: b.cancelledBy,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      completedAt: b.completedAt?.toISOString() ?? null,
    },
    driver: showDriver
      ? {
          name: s.business.driver.name,
          phone: s.business.phone || null,
          whatsapp: s.business.whatsapp || s.business.phone || null,
          photoUrl: s.business.driver.photoUrl || null,
          experienceYears: s.business.driver.experienceYears,
          languages: s.business.driver.languages,
          verified: s.business.driver.licenseVerified,
        }
      : null,
    vehicle:
      showDriver && vehicle
        ? { name: vehicle.name, model: vehicle.model, plateNumber: vehicle.plateNumber, color: vehicle.color }
        : null,
    events: events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    review: review ? { rating: review.rating, comment: review.comment, adminReply: review.adminReply } : null,
    canCancel: canCustomerCancel(b, s),
    payment: {
      open: paymentOpen,
      amountDue,
      upi,
      cashEnabled: s.payment.cashEnabled,
      instructions: s.payment.instructions,
    },
    timezone: s.business.timezone,
  };
}

export type CustomerBookingDetail = Awaited<ReturnType<typeof customerBookingDetail>>;
