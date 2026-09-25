import "server-only";
import { and, asc, avg, count, desc, eq, isNull } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { bookings, customers, reviews, savedPlaces, vehicles, type Customer } from "@/db/schema";
import type { BookingConfig } from "@/components/booking/types";
import { computeEstimate, isTripTypeEnabled, tierFor } from "@/lib/pricing";
import { pricingForVehicle, vehicleRateCard } from "@/lib/vehicle-pricing";
import { TRIP_TYPES } from "@/lib/types";
import { completedRideCount } from "./bookings";
import { signPlace } from "./geo";
import { getSettings } from "./settings";
import { env } from "./env";

export const getActiveVehicles = cache(() => db.select().from(vehicles).where(eq(vehicles.isActive, true)).orderBy(asc(vehicles.sortOrder), asc(vehicles.createdAt)));

export async function getBookingConfig(customer: Customer | null): Promise<BookingConfig> {
  const s = await getSettings();
  const list = await getActiveVehicles();
  let places: BookingConfig["savedPlaces"] = [];
  let tier: string | null = null;
  if (customer) {
    const rows = await db.select().from(savedPlaces).where(eq(savedPlaces.customerId, customer.id)).limit(10);
    places = rows.map((r) => ({
      id: r.id,
      label: r.label,
      place: signPlace({ label: r.address, lat: r.lat, lng: r.lng }),
    }));
    if (s.loyalty.enabled) tier = tierFor(s.loyalty, await completedRideCount(customer.id)).current.name;
  }
  return {
    tripTypes: TRIP_TYPES.filter((t) => isTripTypeEnabled(s.pricing, t)),
    vehicles: list.map((v) => {
      const rc = vehicleRateCard(s.pricing, v);
      return {
        id: v.id,
        slug: v.slug,
        category: v.category,
        imageUrl: v.imageUrl,
        localPct: v.rates?.localMultiplierPct ?? v.priceMultiplier,
        fromPerKm: pricingForVehicle(s.pricing, v).oneWay[s.pricing.acMode === "non-ac-only" ? "nonAcPerKm" : "acPerKm"],
        name: v.name,
        model: v.model,
        seats: v.seats,
        luggage: v.luggage,
        hasAc: v.hasAc,
        features: v.features,
        rates: {
          oneWay: { ac: rc.oneWay.ac, nonAc: rc.oneWay.nonAc },
          roundTrip: { ac: rc.roundTrip.ac, nonAc: rc.roundTrip.nonAc },
          airport: { ac: rc.airport.acBase, nonAc: rc.airport.nonAcBase },
          local: rc.local.map((l) => ({ id: l.id, ac: l.ac, nonAc: l.nonAc })),
        },
      };
    }),
    acMode: s.pricing.acMode,
    localPackages: s.pricing.local.packages.map((p) => ({
      id: p.id,
      label: p.label,
      hours: p.hours,
      km: p.km,
      acPrice: p.acPrice,
      nonAcPrice: p.nonAcPrice,
    })),
    minLeadMinutes: s.booking.minLeadMinutes,
    maxAdvanceDays: s.booking.maxAdvanceDays,
    timezone: s.business.timezone,
    accepting: s.booking.acceptingBookings && list.length > 0,
    pausedMessage: s.booking.pausedMessage,
    customer: customer
      ? {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          rewardBalance: customer.rewardBalance,
          tier,
        }
      : null,
    savedPlaces: places,
    turnstileSiteKey: env().TURNSTILE_SECRET_KEY ? env().TURNSTILE_SITE_KEY : undefined,
    contactPhone: s.business.phone || undefined,
    whatsapp: s.business.whatsapp || s.business.phone || undefined,
    loyaltyEnabled: s.loyalty.enabled,
  };
}

/** Real, aggregate social proof – never fabricated. */
export const getPublicStats = cache(async () => {
  const [[rides], [rating], [riders]] = await Promise.all([
    db.select({ n: count() }).from(bookings).where(eq(bookings.status, "COMPLETED")),
    db.select({ avg: avg(reviews.rating), n: count() }).from(reviews),
    db.select({ n: count() }).from(customers).where(isNull(customers.deletedAt)),
  ]);
  return {
    completedRides: Number(rides?.n ?? 0),
    avgRating: rating?.avg ? Math.round(Number(rating.avg) * 10) / 10 : null,
    reviewCount: Number(rating?.n ?? 0),
    riders: Number(riders?.n ?? 0),
  };
});

export const getPublishedReviews = cache(async () => {
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      adminReply: reviews.adminReply,
      createdAt: reviews.createdAt,
      name: customers.name,
      tripType: bookings.tripType,
      pickup: bookings.pickupAddress,
      drop: bookings.dropAddress,
    })
    .from(reviews)
    .innerJoin(customers, eq(reviews.customerId, customers.id))
    .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
    .where(and(eq(reviews.isPublished, true), isNull(customers.deletedAt)))
    .orderBy(desc(reviews.createdAt))
    .limit(24);
  return rows.map((r) => ({
    ...r,
    // Privacy: first name + initial only.
    name: (() => {
      const parts = r.name.trim().split(/\s+/);
      return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
    })(),
    route: [r.pickup.split(",")[0], r.drop?.split(",")[0]].filter(Boolean).join(" → "),
    createdAt: r.createdAt.toISOString(),
  }));
});

/** Indicative fares for the "popular routes" section (AC, first vehicle, no discounts). */
export async function getRouteFares() {
  const s = await getSettings();
  const list = await getActiveVehicles();
  const mult = list[0]?.priceMultiplier ?? 100;
  const isAc = s.pricing.acMode !== "non-ac-only";
  return s.content.popularRoutes.map((r) => {
    const fare = computeEstimate(s.pricing, {
      tripType: "ONE_WAY",
      isAc,
      multiplierPct: mult,
      km: r.km,
      durationMin: (r.km / 50) * 60,
      pickupHour: 10,
    });
    return {
      ...r,
      fare: fare.total,
      hours: Math.max(1, Math.round((r.km / 50) * 10) / 10),
    };
  });
}
