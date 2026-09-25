/** Validation for admin-managed catalogue entities (client + server). */
import { z } from "zod";
import { VEHICLE_CATEGORIES } from "./types";
import { safeText } from "./validation";

const money = z.number().int().min(0).max(10_000_000).nullish();
export const imageRefSchema = z.union([z.string().regex(/^\/media\/[0-9a-f-]{36}$/), z.url({ protocol: /^https$/ }), z.literal("")]).nullish();
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+){0,6}$/, "lowercase letters, numbers and single dashes");

export const vehicleRatesSchema = z.object({
  oneWayAcPerKm: money,
  oneWayNonAcPerKm: money,
  roundTripAcPerKm: money,
  roundTripNonAcPerKm: money,
  driverBataPerDay: money,
  airportAcBase: money,
  airportNonAcBase: money,
  airportAcPerKm: money,
  airportNonAcPerKm: money,
  localMultiplierPct: z.number().int().min(50).max(500).nullish(),
});

export const vehicleSchema = z.object({
  slug: slugSchema.nullish(),
  category: z.enum(VEHICLE_CATEGORIES),
  name: safeText(40, 2),
  model: safeText(60).optional(),
  description: safeText(300).optional(),
  seats: z.number().int().min(1).max(60),
  luggage: z.number().int().min(0).max(40),
  plateNumber: z.string().trim().toUpperCase().max(16).regex(/^[A-Z0-9 -]*$/).optional(),
  color: safeText(24).optional(),
  features: z.array(safeText(40, 2)).max(10).default([]),
  hasAc: z.boolean(),
  priceMultiplier: z.number().int().min(50).max(500),
  rates: vehicleRatesSchema.default({}),
  imageUrl: imageRefSchema,
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(100).default(0),
});

const lines = (max: number, each: number) => z.array(safeText(each, 2)).max(max).default([]);

export const citySchema = z.object({
  slug: slugSchema,
  name: safeText(60, 2),
  district: safeText(60).optional(),
  state: safeText(60, 2),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  intro: safeText(1500).optional(),
  highlights: lines(10, 140),
  attractions: lines(12, 80),
  airportName: safeText(100).optional(),
  imageUrl: imageRefSchema,
  metaTitle: safeText(70).optional(),
  metaDescription: safeText(170).optional(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export const routeSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+-to-[a-z0-9-]+$/, "use the format from-to-destination, e.g. chennai-to-bengaluru"),
  fromName: safeText(60, 2),
  toName: safeText(60, 2),
  fromCityId: z.uuid().nullish(),
  toCityId: z.uuid().nullish(),
  distanceKm: z.number().int().min(1).max(4000),
  durationMin: z.number().int().min(10).max(6000),
  description: safeText(1500).optional(),
  highlights: lines(10, 140),
  metaTitle: safeText(70).optional(),
  metaDescription: safeText(170).optional(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export const testimonialSchema = z.object({
  name: safeText(60, 2),
  location: safeText(60).optional(),
  rating: z.number().int().min(1).max(5),
  text: safeText(600, 10),
  avatarUrl: imageRefSchema,
  tripLabel: safeText(60).optional(),
  source: safeText(40).optional(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;
export type CityInput = z.infer<typeof citySchema>;
export type RouteInput = z.infer<typeof routeSchema>;
export type TestimonialInput = z.infer<typeof testimonialSchema>;
