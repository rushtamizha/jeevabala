/**
 * Resolves a vehicle's effective rate card. Each vehicle may override any rate;
 * anything not overridden falls back to the global pricing × the vehicle multiplier.
 * The result is a normal PricingSettings object, so the fare engine stays unchanged.
 */
import type { PricingSettings } from "./settings-schema";
import type { VehicleRates } from "./types";

type VehicleLike = { priceMultiplier: number; rates: VehicleRates | null | undefined };

const scale = (amount: number, pct: number) => Math.round((amount * pct) / 100);
const pick = (override: number | null | undefined, fallback: number) =>
  typeof override === "number" && Number.isFinite(override) && override > 0 ? Math.round(override) : fallback;

export function pricingForVehicle(p: PricingSettings, v: VehicleLike): PricingSettings {
  const m = Math.max(50, Math.min(500, v.priceMultiplier || 100));
  const r = v.rates ?? {};
  const localPct = pick(r.localMultiplierPct, m);
  return {
    ...p,
    oneWay: {
      ...p.oneWay,
      acPerKm: pick(r.oneWayAcPerKm, scale(p.oneWay.acPerKm, m)),
      nonAcPerKm: pick(r.oneWayNonAcPerKm, scale(p.oneWay.nonAcPerKm, m)),
      baseFare: scale(p.oneWay.baseFare, m),
      driverBata: pick(r.driverBataPerDay, p.oneWay.driverBata),
    },
    roundTrip: {
      ...p.roundTrip,
      acPerKm: pick(r.roundTripAcPerKm, scale(p.roundTrip.acPerKm, m)),
      nonAcPerKm: pick(r.roundTripNonAcPerKm, scale(p.roundTrip.nonAcPerKm, m)),
      driverBataPerDay: pick(r.driverBataPerDay, p.roundTrip.driverBataPerDay),
    },
    airport: {
      ...p.airport,
      acBaseFare: pick(r.airportAcBase, scale(p.airport.acBaseFare, m)),
      nonAcBaseFare: pick(r.airportNonAcBase, scale(p.airport.nonAcBaseFare, m)),
      acPerKm: pick(r.airportAcPerKm, scale(p.airport.acPerKm, m)),
      nonAcPerKm: pick(r.airportNonAcPerKm, scale(p.airport.nonAcPerKm, m)),
    },
    local: {
      ...p.local,
      packages: p.local.packages.map((pkg) => ({
        ...pkg,
        acPrice: scale(pkg.acPrice, localPct),
        nonAcPrice: scale(pkg.nonAcPrice, localPct),
      })),
      acExtraPerKm: scale(p.local.acExtraPerKm, localPct),
      nonAcExtraPerKm: scale(p.local.nonAcExtraPerKm, localPct),
      extraPerHour: scale(p.local.extraPerHour, localPct),
    },
  };
}

export type VehicleRateCard = {
  oneWay: { ac: number; nonAc: number; minKm: number };
  roundTrip: { ac: number; nonAc: number; minKmPerDay: number };
  driverBata: number;
  airport: { acBase: number; nonAcBase: number; baseKm: number; acPerKm: number; nonAcPerKm: number };
  local: { id: string; label: string; ac: number; nonAc: number }[];
  localExtra: { acPerKm: number; nonAcPerKm: number; perHour: number };
};

/** Display-ready rate card for vehicle cards, the /vehicles page and SEO pages. */
export function vehicleRateCard(p: PricingSettings, v: VehicleLike): VehicleRateCard {
  const e = pricingForVehicle(p, v);
  return {
    oneWay: { ac: e.oneWay.acPerKm, nonAc: e.oneWay.nonAcPerKm, minKm: e.oneWay.minKm },
    roundTrip: { ac: e.roundTrip.acPerKm, nonAc: e.roundTrip.nonAcPerKm, minKmPerDay: e.roundTrip.minKmPerDay },
    driverBata: e.oneWay.driverBata,
    airport: {
      acBase: e.airport.acBaseFare,
      nonAcBase: e.airport.nonAcBaseFare,
      baseKm: e.airport.baseKm,
      acPerKm: e.airport.acPerKm,
      nonAcPerKm: e.airport.nonAcPerKm,
    },
    local: e.local.packages.map((pkg) => ({ id: pkg.id, label: pkg.label, ac: pkg.acPrice, nonAc: pkg.nonAcPrice })),
    localExtra: { acPerKm: e.local.acExtraPerKm, nonAcPerKm: e.local.nonAcExtraPerKm, perHour: e.local.extraPerHour },
  };
}
