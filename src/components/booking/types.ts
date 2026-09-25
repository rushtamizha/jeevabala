import type { FareBreakdown, SignedPlace, TripType } from "@/lib/types";

export type BookingVehicle = {
  id: string;
  slug: string | null;
  category: string;
  imageUrl: string | null;
  /** Effective local-package multiplier (percent) for price previews. */
  localPct: number;
  /** "From" AC one-way rate (paise/km) for the picker. */
  fromPerKm: number;
  /** Display rates per trip type (paise) so the picker can show the fare for the selected trip. */
  rates: {
    oneWay: { ac: number; nonAc: number };
    roundTrip: { ac: number; nonAc: number };
    airport: { ac: number; nonAc: number };
    local: { id: string; ac: number; nonAc: number }[];
  };
  name: string;
  model: string | null;
  seats: number;
  luggage: number;
  hasAc: boolean;
  features: string[];
};

export type BookingConfig = {
  tripTypes: TripType[];
  vehicles: BookingVehicle[];
  acMode: "both" | "ac-only" | "non-ac-only";
  localPackages: { id: string; label: string; hours: number; km: number; acPrice: number; nonAcPrice: number }[];
  minLeadMinutes: number;
  maxAdvanceDays: number;
  timezone: string;
  accepting: boolean;
  pausedMessage: string;
  customer: { name: string; email: string; phone: string | null; rewardBalance: number; tier: string | null } | null;
  savedPlaces: { id: string; label: string; place: SignedPlace }[];
  turnstileSiteKey?: string;
  contactPhone?: string;
  whatsapp?: string;
  loyaltyEnabled: boolean;
};

export type BookingPrefill = Partial<{
  tripType: TripType;
  pickup: SignedPlace;
  drop: SignedPlace;
  isAc: boolean;
  passengers: number;
  vehicleId: string;
  promo: string;
  ref: string;
}>;

export type EstimateResponse = {
  fare: FareBreakdown;
  distanceKm: number | null;
  durationMin: number | null;
  routeSource: "google" | "osrm" | "estimate" | null;
  availability: { ok: true } | { ok: false; reason: string };
  promo: { code: string; applied: boolean; message: string } | null;
  referralApplied: boolean;
  tierName: string | null;
  vehicle: { id: string; name: string; model: string | null; seats: number };
};
