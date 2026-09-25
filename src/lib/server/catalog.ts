import "server-only";
import { and, asc, desc, eq, isNull, ne, or } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { cities, customers, reviews, testimonials, travelRoutes, vehicles, bookings, type City, type TravelRoute, type Vehicle } from "@/db/schema";
import { computeEstimate } from "@/lib/pricing";
import type { PricingSettings } from "@/lib/settings-schema";
import { pricingForVehicle, vehicleRateCard, type VehicleRateCard } from "@/lib/vehicle-pricing";
import { haversineKm } from "./geo";
import { getSettings } from "./settings";

export type FleetVehicle = Pick<Vehicle, "id" | "slug" | "category" | "name" | "model" | "description" | "seats" | "luggage" | "hasAc" | "features" | "imageUrl"> & {
  rateCard: VehicleRateCard;
};

export const getFleet = cache(async (): Promise<FleetVehicle[]> => {
  const s = await getSettings();
  const rows = await db.select().from(vehicles).where(eq(vehicles.isActive, true)).orderBy(asc(vehicles.sortOrder), asc(vehicles.createdAt));
  return rows.map((v) => ({
    id: v.id,
    slug: v.slug,
    category: v.category,
    name: v.name,
    model: v.model,
    description: v.description,
    seats: v.seats,
    luggage: v.luggage,
    hasAc: v.hasAc,
    features: v.features,
    imageUrl: v.imageUrl,
    rateCard: vehicleRateCard(s.pricing, v),
  }));
});

export const getCities = cache(async () =>
  db.select().from(cities).where(eq(cities.isActive, true)).orderBy(desc(cities.isFeatured), asc(cities.sortOrder), asc(cities.name)),
);

export const getCityBySlug = cache(async (slug: string) => {
  const [c] = await db.select().from(cities).where(and(eq(cities.slug, slug), eq(cities.isActive, true))).limit(1);
  return c ?? null;
});

export const getRoutes = cache(async () =>
  db.select().from(travelRoutes).where(eq(travelRoutes.isActive, true)).orderBy(desc(travelRoutes.isFeatured), asc(travelRoutes.sortOrder)),
);

export const getRouteBySlug = cache(async (slug: string) => {
  const [r] = await db.select().from(travelRoutes).where(and(eq(travelRoutes.slug, slug), eq(travelRoutes.isActive, true))).limit(1);
  return r ?? null;
});

export async function routesFromCity(city: City) {
  return db
    .select()
    .from(travelRoutes)
    .where(and(eq(travelRoutes.isActive, true), or(eq(travelRoutes.fromCityId, city.id), eq(travelRoutes.toCityId, city.id))))
    .orderBy(desc(travelRoutes.isFeatured), asc(travelRoutes.sortOrder))
    .limit(12);
}

/** Nearest active cities by straight-line distance (road ≈ ×1.25). */
export async function nearbyCities(city: Pick<City, "id" | "lat" | "lng">, limit = 8) {
  const all = await getCities();
  return all
    .filter((c) => c.id !== city.id)
    .map((c) => ({ city: c, km: Math.round(haversineKm(city, c) * 1.25) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

export type RouteFare = { vehicleId: string; name: string; category: string; seats: number; oneWay: number; roundTrip: number };

/** Indicative AC fares for a distance, per vehicle (no discounts, daytime). */
export function faresForDistance(p: PricingSettings, fleet: Pick<Vehicle, "id" | "name" | "category" | "seats" | "priceMultiplier" | "rates">[], km: number, durationMin: number): RouteFare[] {
  return fleet.map((v) => {
    const vp = pricingForVehicle(p, v);
    const isAc = p.acMode !== "non-ac-only";
    const base = { isAc, multiplierPct: 100, durationMin, pickupHour: 10 } as const;
    const oneWay = computeEstimate(vp, { ...base, tripType: "ONE_WAY", km }).total;
    const roundTrip = computeEstimate(vp, { ...base, tripType: "ROUND_TRIP", km: km * 2, days: Math.max(1, Math.ceil((durationMin * 2) / (12 * 60))) }).total;
    return { vehicleId: v.id, name: v.name, category: v.category, seats: v.seats, oneWay, roundTrip };
  });
}

export const getActiveVehicleRows = cache(() =>
  db.select().from(vehicles).where(eq(vehicles.isActive, true)).orderBy(asc(vehicles.sortOrder), asc(vehicles.createdAt)),
);

export async function routeFares(route: Pick<TravelRoute, "distanceKm" | "durationMin">) {
  const [s, rows] = await Promise.all([getSettings(), getActiveVehicleRows()]);
  return faresForDistance(s.pricing, rows, route.distanceKm, route.durationMin);
}

export type PublicTestimonial = { id: string; name: string; location: string | null; rating: number; text: string; avatarUrl: string | null; tripLabel: string | null; verified: boolean };

/** Admin-curated testimonials + published verified in-app reviews. */
export const getTestimonials = cache(async (): Promise<PublicTestimonial[]> => {
  const [curated, verified] = await Promise.all([
    db.select().from(testimonials).where(eq(testimonials.isActive, true)).orderBy(asc(testimonials.sortOrder), desc(testimonials.createdAt)).limit(24),
    db
      .select({ id: reviews.id, rating: reviews.rating, comment: reviews.comment, name: customers.name, pickup: bookings.pickupAddress, drop: bookings.dropAddress })
      .from(reviews)
      .innerJoin(customers, eq(reviews.customerId, customers.id))
      .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
      .where(and(eq(reviews.isPublished, true), isNull(customers.deletedAt), ne(reviews.comment, "")))
      .orderBy(desc(reviews.createdAt))
      .limit(24),
  ]);
  const shortName = (n: string) => {
    const parts = n.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
  };
  return [
    ...verified
      .filter((r) => r.comment)
      .map((r) => ({
        id: r.id,
        name: shortName(r.name),
        location: null,
        rating: r.rating,
        text: r.comment!,
        avatarUrl: null,
        tripLabel: [r.pickup.split(",")[0], r.drop?.split(",")[0]].filter(Boolean).join(" → "),
        verified: true,
      })),
    ...curated.map((t) => ({ id: t.id, name: t.name, location: t.location, rating: t.rating, text: t.text, avatarUrl: t.avatarUrl, tripLabel: t.tripLabel, verified: false })),
  ];
});

export function citySlugPath(slug: string) {
  return `/${slug}-taxi`;
}
export function routeSlugPath(slug: string) {
  return `/${slug}-taxi`;
}
