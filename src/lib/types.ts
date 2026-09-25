/** Shared, client-safe domain types. */

export const TRIP_TYPES = ["ONE_WAY", "ROUND_TRIP", "AIRPORT", "LOCAL"] as const;
export type TripType = (typeof TRIP_TYPES)[number];

export const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "EN_ROUTE",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = ["UNPAID", "CLAIMED", "PAID", "WAIVED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["UPI", "CASH", "CARD", "BANK", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type FareLine = {
  key: string;
  label: string;
  /** paise; discounts are stored as positive amounts in `discounts` */
  amount: number;
  hint?: string;
};

export type FareBreakdown = {
  lines: FareLine[];
  discounts: FareLine[];
  subtotal: number;
  discountTotal: number;
  tax: number;
  taxPercent: number;
  roundOff: number;
  total: number;
  billableKm: number;
  days: number;
  hours?: number;
  notes: string[];
};

export type FinalFareInput = {
  actualKm?: number;
  actualHours?: number;
  days?: number;
  tolls?: number;
  parking?: number;
  permit?: number;
  waiting?: number;
  other?: number;
  otherLabel?: string;
  extraDiscount?: number;
  overrideTotal?: number;
};

export type FinalFare = FareBreakdown & {
  input: FinalFareInput;
  amountDue: number;
};

/** A geocoded place, HMAC-signed by the server so coordinates can't be tampered with. */
export type SignedPlace = {
  label: string;
  secondary?: string;
  lat: number;
  lng: number;
  sig: string;
};

export const TRIP_TYPE_LABEL: Record<TripType, string> = {
  ONE_WAY: "One Way",
  ROUND_TRIP: "Round Trip",
  AIRPORT: "Airport",
  LOCAL: "Local Hourly",
};

export const TRIP_TYPE_DESCRIPTION: Record<TripType, string> = {
  ONE_WAY: "Outstation drop — pay only one way",
  ROUND_TRIP: "Outstation with return journey",
  AIRPORT: "Pickups & drops, flight-aware",
  LOCAL: "Hourly packages within the city",
};

export const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  EN_ROUTE: "Driver on the way",
  ARRIVED: "Driver arrived",
  IN_PROGRESS: "Trip in progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REJECTED: "Declined",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Payment due",
  CLAIMED: "Verifying payment",
  PAID: "Paid",
  WAIVED: "Waived",
};

export const ACTIVE_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"];
export const ENGAGED_STATUSES: BookingStatus[] = ["CONFIRMED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"];
export const TERMINAL_STATUSES: BookingStatus[] = ["COMPLETED", "CANCELLED", "REJECTED"];

export const VEHICLE_CATEGORIES = ["HATCHBACK", "SEDAN", "SUV", "MUV", "LUXURY", "TEMPO", "BUS"] as const;
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

export const VEHICLE_CATEGORY_LABEL: Record<VehicleCategory, string> = {
  HATCHBACK: "Hatchback",
  SEDAN: "Sedan",
  SUV: "SUV",
  MUV: "MUV",
  LUXURY: "Luxury",
  TEMPO: "Tempo Traveller",
  BUS: "Mini Bus",
};

/** Per-vehicle rate card (paise). Missing values fall back to global pricing × multiplier. */
export type VehicleRates = {
  oneWayAcPerKm?: number | null;
  oneWayNonAcPerKm?: number | null;
  roundTripAcPerKm?: number | null;
  roundTripNonAcPerKm?: number | null;
  driverBataPerDay?: number | null;
  airportAcBase?: number | null;
  airportNonAcBase?: number | null;
  airportAcPerKm?: number | null;
  airportNonAcPerKm?: number | null;
  /** Local package price multiplier in percent. */
  localMultiplierPct?: number | null;
};
