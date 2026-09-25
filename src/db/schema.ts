/**
 * Database schema (PostgreSQL, Drizzle ORM).
 *
 * Conventions
 * - All money values are stored as integer **paise** (1 INR = 100 paise) to avoid float errors.
 * - All timestamps are `timestamptz` and stored in UTC.
 * - Secrets are never stored in plaintext: session tokens and OTPs are hashed,
 *   integration credentials / TOTP secrets are AES-256-GCM encrypted.
 */
import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { VEHICLE_CATEGORIES, type FareBreakdown, type FinalFare, type VehicleRates } from "../lib/types";

/* ----------------------------------------------------------------------------
 * Enums
 * ------------------------------------------------------------------------- */

export const tripTypeEnum = pgEnum("trip_type", ["ONE_WAY", "ROUND_TRIP", "AIRPORT", "LOCAL"]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "PENDING",
  "CONFIRMED",
  "EN_ROUTE",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
]);

export const paymentStatusEnum = pgEnum("payment_status", ["UNPAID", "CLAIMED", "PAID", "WAIVED"]);

export const paymentMethodEnum = pgEnum("payment_method", ["UPI", "CASH", "CARD", "BANK", "OTHER"]);

export const customerStatusEnum = pgEnum("customer_status", ["ACTIVE", "BLOCKED"]);

export const actorEnum = pgEnum("actor_type", ["CUSTOMER", "ADMIN", "SYSTEM", "TELEGRAM"]);

export const notificationChannelEnum = pgEnum("notification_channel", ["TELEGRAM", "WHATSAPP", "EMAIL"]);

export const notificationStatusEnum = pgEnum("notification_status", ["PENDING", "SENT", "FAILED", "SKIPPED"]);

export const discountTypeEnum = pgEnum("discount_type", ["PERCENT", "FLAT"]);

export const rewardTxnTypeEnum = pgEnum("reward_txn_type", [
  "REFERRAL_BONUS",
  "REDEEM",
  "REFUND",
  "ADJUSTMENT",
]);

export const sessionKindEnum = pgEnum("session_kind", ["ADMIN", "CUSTOMER"]);

/* ----------------------------------------------------------------------------
 * Shared JSON types
 * ------------------------------------------------------------------------- */

export type { FareBreakdown, FareLine, FinalFare, FinalFareInput, VehicleRates } from "../lib/types";

/* ----------------------------------------------------------------------------
 * Tables
 * ------------------------------------------------------------------------- */

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

export const admins = pgTable(
  "admins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    totpSecretEnc: text("totp_secret_enc"),
    totpPendingSecretEnc: text("totp_pending_secret_enc"),
    totpEnabled: boolean("totp_enabled").default(false).notNull(),
    /** Last accepted TOTP time-step, prevents code replay. */
    totpLastCounter: integer("totp_last_counter"),
    /** sha256 hashes of single-use recovery codes */
    recoveryCodes: jsonb("recovery_codes").$type<string[]>().default([]).notNull(),
    failedLogins: integer("failed_logins").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    lastLoginIp: text("last_login_ip"),
    alertsSeenAt: timestamp("alerts_seen_at", { withTimezone: true }).defaultNow().notNull(),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("admins_email_uq").on(t.email)],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** lower-cased; the verified login identity */
    email: text("email").notNull(),
    name: text("name").notNull(),
    /** E.164 */
    phone: text("phone"),
    status: customerStatusEnum("status").default("ACTIVE").notNull(),
    referralCode: text("referral_code").notNull(),
    referredById: uuid("referred_by_id"),
    /** reward credits, paise */
    rewardBalance: integer("reward_balance").default(0).notNull(),
    marketingOptIn: boolean("marketing_opt_in").default(true).notNull(),
    whatsappOptIn: boolean("whatsapp_opt_in").default(true).notNull(),
    adminNote: text("admin_note"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("customers_email_uq").on(t.email),
    uniqueIndex("customers_referral_code_uq").on(t.referralCode),
    index("customers_phone_idx").on(t.phone),
    index("customers_created_idx").on(t.createdAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    /** sha256(token) – the raw token only ever lives in the user's httpOnly cookie */
    id: text("id").primaryKey(),
    kind: sessionKindEnum("kind").notNull(),
    adminId: uuid("admin_id").references(() => admins.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    mfaPending: boolean("mfa_pending").default(false).notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("sessions_admin_idx").on(t.adminId),
    index("sessions_customer_idx").on(t.customerId),
    index("sessions_expires_idx").on(t.expiresAt),
  ],
);

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    /** HMAC-SHA256(code) keyed with a server secret */
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("otp_email_created_idx").on(t.email, t.createdAt)],
);

export { VEHICLE_CATEGORIES };

export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug"),
  category: text("category", { enum: VEHICLE_CATEGORIES }).default("SEDAN").notNull(),
  name: text("name").notNull(),
  model: text("model"),
  description: text("description"),
  rates: jsonb("rates").$type<VehicleRates>().default({}).notNull(),
  seats: smallint("seats").notNull(),
  luggage: smallint("luggage").default(2).notNull(),
  plateNumber: text("plate_number"),
  color: text("color"),
  features: jsonb("features").$type<string[]>().default([]).notNull(),
  hasAc: boolean("has_ac").default(true).notNull(),
  /** price multiplier in percent (100 = 1.0x) */
  priceMultiplier: integer("price_multiplier").default(100).notNull(),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("vehicles_slug_uq").on(t.slug)]);

export const promoCodes = pgTable(
  "promo_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    description: text("description"),
    discountType: discountTypeEnum("discount_type").notNull(),
    /** percent (1-100) for PERCENT, paise for FLAT */
    value: integer("value").notNull(),
    maxDiscount: integer("max_discount"),
    minFare: integer("min_fare"),
    usageLimit: integer("usage_limit"),
    perCustomerLimit: integer("per_customer_limit").default(1).notNull(),
    firstRideOnly: boolean("first_ride_only").default(false).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("promo_codes_code_uq").on(t.code)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    status: bookingStatusEnum("status").default("PENDING").notNull(),
    tripType: tripTypeEnum("trip_type").notNull(),

    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    vehicleName: text("vehicle_name").notNull(),
    isAc: boolean("is_ac").notNull(),
    passengers: smallint("passengers").notNull(),

    pickupAddress: text("pickup_address").notNull(),
    pickupLat: doublePrecision("pickup_lat").notNull(),
    pickupLng: doublePrecision("pickup_lng").notNull(),
    dropAddress: text("drop_address"),
    dropLat: doublePrecision("drop_lat"),
    dropLng: doublePrecision("drop_lng"),

    pickupAt: timestamp("pickup_at", { withTimezone: true }).notNull(),
    returnAt: timestamp("return_at", { withTimezone: true }),
    /** Estimated end of the driver's engagement; used for single-driver conflict detection. */
    estimatedEndAt: timestamp("estimated_end_at", { withTimezone: true }).notNull(),
    localPackage: text("local_package"),

    distanceMeters: integer("distance_meters"),
    durationSeconds: integer("duration_seconds"),
    routeSource: text("route_source"),

    contactName: text("contact_name").notNull(),
    contactPhone: text("contact_phone").notNull(),
    contactEmail: text("contact_email").notNull(),
    customerNote: text("customer_note"),

    fareEstimate: integer("fare_estimate").notNull(),
    fareBreakdown: jsonb("fare_breakdown").$type<FareBreakdown>().notNull(),
    discountTotal: integer("discount_total").default(0).notNull(),
    promoCodeId: uuid("promo_code_id").references(() => promoCodes.id, { onDelete: "set null" }),
    promoCode: text("promo_code"),
    referralApplied: boolean("referral_applied").default(false).notNull(),
    rewardRedeemed: integer("reward_redeemed").default(0).notNull(),
    loyaltyTier: text("loyalty_tier"),

    quotedFare: integer("quoted_fare"),
    finalFare: integer("final_fare"),
    finalBreakdown: jsonb("final_breakdown").$type<FinalFare>(),

    paymentStatus: paymentStatusEnum("payment_status").default("UNPAID").notNull(),
    paymentMethod: paymentMethodEnum("payment_method"),
    paymentReference: text("payment_reference"),
    paymentClaimedAt: timestamp("payment_claimed_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),

    ridePin: text("ride_pin").notNull(),
    adminNote: text("admin_note"),
    cancelReason: text("cancel_reason"),
    cancelledBy: actorEnum("cancelled_by"),
    source: text("source").default("WEB").notNull(),
    clientIp: text("client_ip"),
    userAgent: text("user_agent"),

    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    enRouteAt: timestamp("en_route_at", { withTimezone: true }),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("bookings_code_uq").on(t.code),
    index("bookings_customer_created_idx").on(t.customerId, t.createdAt),
    index("bookings_status_pickup_idx").on(t.status, t.pickupAt),
    index("bookings_pickup_idx").on(t.pickupAt),
    index("bookings_payment_status_idx").on(t.paymentStatus),
  ],
);

export const bookingEvents = pgTable(
  "booking_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    fromStatus: bookingStatusEnum("from_status"),
    toStatus: bookingStatusEnum("to_status"),
    actor: actorEnum("actor").notNull(),
    actorId: uuid("actor_id"),
    message: text("message"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    visibleToCustomer: boolean("visible_to_customer").default(true).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("booking_events_booking_idx").on(t.bookingId, t.createdAt),
    index("booking_events_created_idx").on(t.createdAt),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    comment: text("comment"),
    isPublished: boolean("is_published").default(false).notNull(),
    adminReply: text("admin_reply"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("reviews_booking_uq").on(t.bookingId),
    index("reviews_published_idx").on(t.isPublished, t.createdAt),
  ],
);

export const savedPlaces = pgTable(
  "saved_places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    address: text("address").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("saved_places_customer_idx").on(t.customerId)],
);

export const rewardTransactions = pgTable(
  "reward_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    type: rewardTxnTypeEnum("type").notNull(),
    /** paise; positive = credit, negative = debit */
    amount: integer("amount").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("reward_txn_customer_idx").on(t.customerId, t.createdAt)],
);

export const blackouts = pgTable(
  "blackouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("blackouts_range_idx").on(t.startsAt, t.endsAt)],
);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/** Uploaded images (re-encoded to WebP on upload). Stored in the DB so it works on any host. */
export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
  size: integer("size").notNull(),
  width: integer("width"),
  height: integer("height"),
  sha256: text("sha256").notNull(),
  alt: text("alt"),
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
});

/** SEO landing pages per district/city, e.g. /chennai-taxi. */
export const cities = pgTable(
  "cities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    district: text("district"),
    state: text("state").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    intro: text("intro"),
    highlights: jsonb("highlights").$type<string[]>().default([]).notNull(),
    attractions: jsonb("attractions").$type<string[]>().default([]).notNull(),
    airportName: text("airport_name"),
    imageUrl: text("image_url"),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    isActive: boolean("is_active").default(true).notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("cities_slug_uq").on(t.slug), index("cities_active_idx").on(t.isActive, t.sortOrder)],
);

/** SEO route pages, e.g. /chennai-to-bengaluru-taxi. */
export const travelRoutes = pgTable(
  "travel_routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    fromName: text("from_name").notNull(),
    toName: text("to_name").notNull(),
    fromCityId: uuid("from_city_id").references(() => cities.id, { onDelete: "set null" }),
    toCityId: uuid("to_city_id").references(() => cities.id, { onDelete: "set null" }),
    distanceKm: integer("distance_km").notNull(),
    durationMin: integer("duration_min").notNull(),
    description: text("description"),
    highlights: jsonb("highlights").$type<string[]>().default([]).notNull(),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    isActive: boolean("is_active").default(true).notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("travel_routes_slug_uq").on(t.slug), index("travel_routes_from_idx").on(t.fromCityId)],
);

/** Curated testimonials (e.g. from Google/WhatsApp) shown alongside verified in-app reviews. */
export const testimonials = pgTable("testimonials", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  location: text("location"),
  rating: smallint("rating").default(5).notNull(),
  text: text("text").notNull(),
  avatarUrl: text("avatar_url"),
  tripLabel: text("trip_label"),
  source: text("source"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by"),
  updatedAt: updatedAt(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorType: actorEnum("actor_type").notNull(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt), index("audit_actor_idx").on(t.actorId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: notificationChannelEnum("channel").notNull(),
    audience: text("audience", { enum: ["ADMIN", "CUSTOMER"] }).notNull(),
    event: text("event").notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    recipient: text("recipient").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: notificationStatusEnum("status").default("PENDING").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_status_idx").on(t.status, t.createdAt),
    index("notifications_booking_idx").on(t.bookingId),
  ],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_limits_reset_idx").on(t.resetAt)],
);

/* ----------------------------------------------------------------------------
 * Inferred types
 * ------------------------------------------------------------------------- */

export type Admin = typeof admins.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type BookingEvent = typeof bookingEvents.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type City = typeof cities.$inferSelect;
export type TravelRoute = typeof travelRoutes.$inferSelect;
export type Testimonial = typeof testimonials.$inferSelect;
export type PromoCode = typeof promoCodes.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type SavedPlace = typeof savedPlaces.$inferSelect;
export type Blackout = typeof blackouts.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number];
export type TripType = (typeof tripTypeEnum.enumValues)[number];
export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];
export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number];
export type ActorType = (typeof actorEnum.enumValues)[number];
