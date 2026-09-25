/**
 * Typed, validated application settings (stored as JSON rows in `settings`).
 * Client-safe: used by admin forms for validation and by the server for parsing.
 *
 * Money values are integer paise. Zod v4 `.prefault({})` is used for nested
 * objects so inner defaults are applied when a nested object is missing.
 */
import { z } from "zod";

const paise = z.number().int().min(0).max(100_000_000);
const hour = z.number().int().min(0).max(23);
const optionalUrl = z.union([z.url({ protocol: /^https$/ }), z.literal("")]).default("");
/** An uploaded image (/media/<uuid>) or an https URL. */
const imageRef = z.union([z.string().regex(/^\/media\/[0-9a-f-]{36}$/), z.url({ protocol: /^https$/ }), z.literal("")]).default("");

/* ----------------------------------------------------------------------------
 * Business profile
 * ------------------------------------------------------------------------- */

export const DriverProfileSchema = z.object({
  name: z.string().trim().min(2).max(60).default("Your Driver"),
  experienceYears: z.number().int().min(0).max(60).default(10),
  languages: z.array(z.string().trim().min(2).max(20)).max(8).default(["English", "Tamil", "Hindi"]),
  bio: z
    .string()
    .trim()
    .max(500)
    .default(
      "Professional, background-verified chauffeur with a spotless safety record. Punctual, courteous and knows every highway like the back of his hand.",
    ),
  photoUrl: imageRef,
  licenseVerified: z.boolean().default(true),
});

export const BusinessSettingsSchema = z.object({
  name: z.string().trim().min(2).max(60).default("Saarathi Cabs"),
  tagline: z.string().trim().max(120).default("Your personal chauffeur — on time, every time."),
  phone: z.string().trim().max(20).default(""),
  whatsapp: z.string().trim().max(20).default(""),
  email: z.union([z.email(), z.literal("")]).default(""),
  address: z.string().trim().max(240).default(""),
  city: z.string().trim().max(60).default("Chennai"),
  region: z.string().trim().max(60).default("Tamil Nadu"),
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .default("IN"),
  timezone: z.string().min(3).max(64).default("Asia/Kolkata"),
  serviceLat: z.number().min(-90).max(90).default(13.0827),
  serviceLng: z.number().min(-180).max(180).default(80.2707),
  gstin: z.string().trim().max(20).default(""),
  bookingPrefix: z
    .string()
    .regex(/^[A-Z]{2,4}$/, "2–4 capital letters")
    .default("SR"),
  announcement: z.string().trim().max(160).default(""),
  social: z
    .object({
      instagram: optionalUrl,
      facebook: optionalUrl,
      youtube: optionalUrl,
      x: optionalUrl,
    })
    .prefault({}),
  driver: DriverProfileSchema.prefault({}),
});

/* ----------------------------------------------------------------------------
 * Pricing
 * ------------------------------------------------------------------------- */

export const LocalPackageSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,24}$/, "lowercase letters, numbers and dashes"),
  label: z.string().trim().min(2).max(40),
  hours: z.number().int().min(1).max(24),
  km: z.number().int().min(1).max(500),
  acPrice: paise,
  nonAcPrice: paise,
});

export const PricingSettingsSchema = z.object({
  acMode: z.enum(["both", "ac-only", "non-ac-only"]).default("both"),
  oneWay: z
    .object({
      enabled: z.boolean().default(true),
      acPerKm: paise.default(1400),
      nonAcPerKm: paise.default(1300),
      minKm: z.number().int().min(0).max(1000).default(130),
      driverBata: paise.default(40000),
      baseFare: paise.default(0),
    })
    .prefault({}),
  roundTrip: z
    .object({
      enabled: z.boolean().default(true),
      acPerKm: paise.default(1300),
      nonAcPerKm: paise.default(1200),
      minKmPerDay: z.number().int().min(0).max(1000).default(250),
      driverBataPerDay: paise.default(40000),
    })
    .prefault({}),
  airport: z
    .object({
      enabled: z.boolean().default(true),
      acBaseFare: paise.default(60000),
      nonAcBaseFare: paise.default(50000),
      baseKm: z.number().int().min(0).max(200).default(10),
      acPerKm: paise.default(1800),
      nonAcPerKm: paise.default(1600),
      airportFee: paise.default(0),
    })
    .prefault({}),
  local: z
    .object({
      enabled: z.boolean().default(true),
      packages: z
        .array(LocalPackageSchema)
        .min(1)
        .max(8)
        .default([
          { id: "4h40", label: "4 hrs · 40 km", hours: 4, km: 40, acPrice: 150000, nonAcPrice: 130000 },
          { id: "8h80", label: "8 hrs · 80 km", hours: 8, km: 80, acPrice: 260000, nonAcPrice: 230000 },
          { id: "12h120", label: "12 hrs · 120 km", hours: 12, km: 120, acPrice: 380000, nonAcPrice: 340000 },
        ]),
      acExtraPerKm: paise.default(1600),
      nonAcExtraPerKm: paise.default(1400),
      extraPerHour: paise.default(20000),
    })
    .prefault({}),
  nightCharge: z
    .object({
      enabled: z.boolean().default(true),
      startHour: hour.default(22),
      endHour: hour.default(6),
      percent: z.number().min(0).max(100).default(10),
    })
    .prefault({}),
  taxPercent: z.number().min(0).max(28).default(0),
  /** Round the payable total to the nearest N rupees. */
  roundTo: z.union([z.literal(1), z.literal(5), z.literal(10), z.literal(50), z.literal(100)]).default(10),
  notes: z
    .array(z.string().trim().min(3).max(160))
    .max(6)
    .default([
      "Toll, parking and inter-state permit charges are extra, as actuals.",
      "Final fare is based on actual kilometres travelled.",
    ]),
});

/* ----------------------------------------------------------------------------
 * Booking policy
 * ------------------------------------------------------------------------- */

export const BookingSettingsSchema = z.object({
  acceptingBookings: z.boolean().default(true),
  pausedMessage: z
    .string()
    .trim()
    .max(200)
    .default("Online booking is paused right now. Please call or WhatsApp us to book."),
  minLeadMinutes: z.number().int().min(0).max(10080).default(60),
  maxAdvanceDays: z.number().int().min(1).max(365).default(90),
  blockOverlaps: z.boolean().default(true),
  bufferMinutes: z.number().int().min(0).max(720).default(45),
  requireRidePin: z.boolean().default(true),
  /** Customers may cancel free of charge until this many minutes before pickup. */
  customerCancelCutoffMinutes: z.number().int().min(0).max(2880).default(60),
  maxActiveBookingsPerCustomer: z.number().int().min(1).max(20).default(3),
  autoConfirm: z.boolean().default(false),
});

/* ----------------------------------------------------------------------------
 * Payments (manual UPI / cash)
 * ------------------------------------------------------------------------- */

export const UPI_ID_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;

export const PaymentSettingsSchema = z.object({
  upiEnabled: z.boolean().default(true),
  upiId: z.union([z.string().trim().regex(UPI_ID_RE, "Enter a valid UPI ID, e.g. name@okbank"), z.literal("")]).default(""),
  payeeName: z.string().trim().max(60).default(""),
  cashEnabled: z.boolean().default(true),
  instructions: z
    .string()
    .trim()
    .max(300)
    .default("Pay after your ride using any UPI app, then tap “I’ve paid” and share the UTR number for instant confirmation."),
});

/* ----------------------------------------------------------------------------
 * Loyalty & referrals
 * ------------------------------------------------------------------------- */

export const LoyaltyTierSchema = z.object({
  name: z.string().trim().min(2).max(20),
  minRides: z.number().int().min(0).max(1000),
  discountPercent: z.number().min(0).max(50),
});

export const LoyaltySettingsSchema = z.object({
  enabled: z.boolean().default(true),
  tiers: z
    .array(LoyaltyTierSchema)
    .min(1)
    .max(6)
    .default([
      { name: "Member", minRides: 0, discountPercent: 0 },
      { name: "Silver", minRides: 3, discountPercent: 3 },
      { name: "Gold", minRides: 10, discountPercent: 5 },
      { name: "Platinum", minRides: 25, discountPercent: 8 },
    ]),
  maxTierDiscount: paise.default(50000),
  maxRedeemPercent: z.number().int().min(0).max(100).default(20),
  referral: z
    .object({
      enabled: z.boolean().default(true),
      refereeDiscount: paise.default(10000),
      referrerBonus: paise.default(10000),
    })
    .prefault({}),
});

/* ----------------------------------------------------------------------------
 * Notification routing
 * ------------------------------------------------------------------------- */

export const NotificationSettingsSchema = z.object({
  admin: z
    .object({
      telegram: z.boolean().default(true),
      whatsapp: z.boolean().default(true),
      email: z.boolean().default(true),
    })
    .prefault({}),
  customer: z
    .object({
      email: z.boolean().default(true),
      whatsapp: z.boolean().default(true),
    })
    .prefault({}),
  adminEmail: z.union([z.email(), z.literal("")]).default(""),
});

/* ----------------------------------------------------------------------------
 * Integrations – as stored (secrets are AES-256-GCM ciphertexts)
 * ------------------------------------------------------------------------- */

export const WHATSAPP_PROVIDERS = ["none", "meta", "twilio", "callmebot"] as const;

export const IntegrationsStoredSchema = z.object({
  telegram: z
    .object({
      botTokenEnc: z.string().default(""),
      chatId: z.string().max(32).default(""),
      webhookSecretEnc: z.string().default(""),
      webhookEnabled: z.boolean().default(false),
    })
    .prefault({}),
  whatsapp: z
    .object({
      provider: z.enum(WHATSAPP_PROVIDERS).default("none"),
      adminNumber: z.string().max(20).default(""),
      metaTokenEnc: z.string().default(""),
      metaPhoneNumberId: z.string().max(40).default(""),
      metaTemplate: z.string().max(60).default(""),
      metaTemplateLang: z.string().max(10).default("en"),
      metaApiVersion: z.string().max(10).default("v23.0"),
      twilioSid: z.string().max(64).default(""),
      twilioTokenEnc: z.string().default(""),
      twilioFrom: z.string().max(24).default(""),
      callmebotApiKeyEnc: z.string().default(""),
    })
    .prefault({}),
  smtp: z
    .object({
      host: z.string().max(120).default(""),
      port: z.number().int().min(1).max(65535).default(587),
      secure: z.boolean().default(false),
      user: z.string().max(160).default(""),
      passEnc: z.string().default(""),
      from: z.string().max(160).default(""),
    })
    .prefault({}),
});

/* ----------------------------------------------------------------------------
 * Website content
 * ------------------------------------------------------------------------- */

export const WHY_ICONS = ["shield", "clock", "wallet", "star", "car", "headset", "map", "sparkles", "badge", "route"] as const;

export const ContentSettingsSchema = z.object({
  heroImageUrl: imageRef,
  /** Background slides for the home hero (uploaded via admin). Falls back to illustrated scenes. */
  heroImages: z.array(imageRef).max(6).default([]),
  heroEyebrow: z.string().trim().max(60).default(""),
  whyChooseUs: z
    .array(z.object({ icon: z.enum(WHY_ICONS), title: z.string().trim().min(2).max(40), body: z.string().trim().min(2).max(140) }))
    .max(8)
    .default([
      { icon: "badge", title: "Verified driver", body: "Licensed, background-checked and courteous — every single ride." },
      { icon: "wallet", title: "Honest fares", body: "Itemised estimate up front. No surge, no hidden charges." },
      { icon: "clock", title: "Always on time", body: "Punctual pickups, flight-aware airport runs, 24×7." },
      { icon: "sparkles", title: "Clean cars", body: "Sanitised and well-maintained vehicles, AC or non-AC." },
      { icon: "shield", title: "Safe by design", body: "Private Ride PIN and live trip status for every booking." },
      { icon: "headset", title: "Real support", body: "Talk to a real person on call or WhatsApp, anytime." },
    ]),
  heroTitle: z.string().trim().max(80).default("Your personal chauffeur,"),
  heroHighlight: z.string().trim().max(40).default("anywhere you go."),
  heroSubtitle: z
    .string()
    .trim()
    .max(220)
    .default(
      "Outstation drops, round trips, airport transfers and local rides with one trusted, verified driver. Transparent fares, no surge — ever.",
    ),
  popularRoutes: z
    .array(
      z.object({
        from: z.string().trim().min(2).max(40),
        to: z.string().trim().min(2).max(40),
        km: z.number().int().min(1).max(3000),
      }),
    )
    .max(12)
    .default([
      { from: "Chennai", to: "Bengaluru", km: 346 },
      { from: "Chennai", to: "Puducherry", km: 151 },
      { from: "Chennai", to: "Tirupati", km: 135 },
      { from: "Chennai", to: "Vellore", km: 140 },
      { from: "Chennai", to: "Madurai", km: 462 },
      { from: "Chennai", to: "Coimbatore", km: 507 },
    ]),
  faqs: z
    .array(z.object({ q: z.string().trim().min(5).max(160), a: z.string().trim().min(5).max(800) }))
    .max(20)
    .default([
      {
        q: "How is the fare calculated?",
        a: "Outstation fares are per kilometre with a daily driver allowance; airport transfers use a base fare plus distance; local rides use hourly packages. The estimate you see before booking is itemised — no hidden charges and no surge pricing.",
      },
      {
        q: "Are tolls and parking included?",
        a: "Toll, parking and inter-state permit charges are paid as actuals and added to your final bill with receipts where applicable.",
      },
      {
        q: "How do I pay?",
        a: "After the trip you'll see the exact amount and a UPI QR code in your booking. Pay with any UPI app (GPay, PhonePe, Paytm, BHIM) or in cash to the driver.",
      },
      {
        q: "Can I cancel my booking?",
        a: "Yes. You can cancel free of charge from your dashboard before the driver starts towards your pickup location.",
      },
      {
        q: "Is it safe for solo and late-night travel?",
        a: "Every ride has a unique 4-digit Ride PIN that you share with the driver only when you board, and your live booking status is always visible in your dashboard.",
      },
      {
        q: "How early should I book?",
        a: "We recommend booking at least a few hours in advance — and a day ahead for outstation trips — so we can guarantee your slot.",
      },
    ]),
});

/* ----------------------------------------------------------------------------
 * Registry
 * ------------------------------------------------------------------------- */

export const SETTINGS_SCHEMAS = {
  business: BusinessSettingsSchema,
  pricing: PricingSettingsSchema,
  booking: BookingSettingsSchema,
  payment: PaymentSettingsSchema,
  loyalty: LoyaltySettingsSchema,
  notifications: NotificationSettingsSchema,
  integrations: IntegrationsStoredSchema,
  content: ContentSettingsSchema,
} as const;

export type SettingsKey = keyof typeof SETTINGS_SCHEMAS;
export type SettingsMap = { [K in SettingsKey]: z.infer<(typeof SETTINGS_SCHEMAS)[K]> };

export type BusinessSettings = SettingsMap["business"];
export type PricingSettings = SettingsMap["pricing"];
export type BookingSettings = SettingsMap["booking"];
export type PaymentSettings = SettingsMap["payment"];
export type LoyaltySettings = SettingsMap["loyalty"];
export type NotificationSettings = SettingsMap["notifications"];
export type IntegrationsStored = SettingsMap["integrations"];
export type ContentSettings = SettingsMap["content"];
export type LocalPackage = z.infer<typeof LocalPackageSchema>;
export type LoyaltyTier = z.infer<typeof LoyaltyTierSchema>;
