/** Shared request schemas (client + server). The server always re-validates. */
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";
import { z } from "zod";
import { TRIP_TYPES } from "./types";
import { WALL_TIME_RE } from "./time";

/** Strip control characters and collapse whitespace from free text. */
export function cleanText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export const safeText = (max: number, min = 0) =>
  z
    .string()
    .max(max * 2)
    .transform(cleanText)
    .pipe(z.string().min(min).max(max));

export const personName = safeText(60, 2).refine((v) => /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u.test(v), {
  message: "Please enter a valid name",
});

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Please enter a valid email address"));

export function normalizePhone(input: string, country: CountryCode = "IN"): string | null {
  const parsed = parsePhoneNumberFromString(input, country);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number; // E.164
}

export const phoneSchema = z
  .string()
  .trim()
  .max(20)
  .transform((v, ctx) => {
    const e164 = normalizePhone(v);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "Please enter a valid mobile number" });
      return z.NEVER;
    }
    return e164;
  });

export const signedPlaceSchema = z.object({
  label: safeText(200, 2),
  secondary: safeText(200).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  sig: z.string().length(32),
});

export const wallTimeSchema = z.string().regex(WALL_TIME_RE, "Invalid date/time");

export const promoCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(24)
  .regex(/^[A-Z0-9-]*$/, "Invalid code");

export const tripRequestSchema = z.object({
  tripType: z.enum(TRIP_TYPES),
  pickup: signedPlaceSchema,
  drop: signedPlaceSchema.nullish(),
  pickupAt: wallTimeSchema,
  returnAt: wallTimeSchema.nullish(),
  localPackageId: z
    .string()
    .regex(/^[a-z0-9-]{2,24}$/)
    .nullish(),
  vehicleId: z.uuid().nullish(),
  isAc: z.boolean(),
  passengers: z.number().int().min(1).max(20),
  promoCode: promoCodeSchema.optional(),
  useCredits: z.boolean().optional(),
});

export type TripRequest = z.infer<typeof tripRequestSchema>;

export const bookingCreateSchema = tripRequestSchema.extend({
  contact: z.object({
    name: personName,
    phone: phoneSchema,
    email: emailSchema,
  }),
  note: safeText(500).optional(),
  /** Honeypot – must be empty. */
  website: z.string().max(0).optional(),
  /** Client-side render timestamp, used as a weak bot signal. */
  startedAt: z.number().int().optional(),
});

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

export const otpRequestSchema = z.object({
  email: emailSchema,
  website: z.string().max(0).optional(),
  turnstileToken: z.string().max(4096).optional(),
});

export const otpVerifySchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  name: personName.optional(),
  phone: phoneSchema.optional(),
  referralCode: z
    .string()
    .trim()
    .toUpperCase()
    .max(16)
    .regex(/^[A-Z0-9]*$/)
    .optional(),
});

export const utrSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^[A-Za-z0-9-]*$/, "Use letters and numbers only");

export const uuidSchema = z.uuid();
