/**
 * Fare engine – pure functions, shared by server (authoritative) and client (previews).
 * All amounts are integer paise.
 */
import { formatINR, formatRate } from "./format";
import type { LoyaltySettings, PricingSettings } from "./settings-schema";
import { isNightHour } from "./time";
import type { FareBreakdown, FareLine, FinalFare, FinalFareInput, TripType } from "./types";

export type FareInput = {
  tripType: TripType;
  isAc: boolean;
  /** Vehicle price multiplier in percent (100 = 1.0x). */
  multiplierPct: number;
  /** One-way distance for ONE_WAY / AIRPORT; total distance for ROUND_TRIP; actual km for LOCAL finals. */
  km: number;
  /** One-way driving time in minutes. */
  durationMin: number;
  /** Pickup hour (0–23) in the business timezone. */
  pickupHour: number;
  /** ROUND_TRIP: number of calendar days. */
  days?: number;
  localPackageId?: string | null;
  /** LOCAL finals: hours actually used. */
  actualHours?: number;
};

type BaseFare = {
  lines: FareLine[];
  /** Portion of lines eligible for discounts/tax (excludes pass-through charges). */
  discountBase: number;
  billableKm: number;
  days: number;
  hours?: number;
  nightApplied: boolean;
};

const RATE_KEYS = new Set(["base", "distance", "extra_km", "package", "extra_hours"]);

const mult = (amount: number, pct: number) => Math.round((amount * pct) / 100);

export function perKmRate(p: PricingSettings, tripType: TripType, isAc: boolean): number {
  switch (tripType) {
    case "ONE_WAY":
      return isAc ? p.oneWay.acPerKm : p.oneWay.nonAcPerKm;
    case "ROUND_TRIP":
      return isAc ? p.roundTrip.acPerKm : p.roundTrip.nonAcPerKm;
    case "AIRPORT":
      return isAc ? p.airport.acPerKm : p.airport.nonAcPerKm;
    case "LOCAL":
      return isAc ? p.local.acExtraPerKm : p.local.nonAcExtraPerKm;
  }
}

export function isTripTypeEnabled(p: PricingSettings, t: TripType): boolean {
  return {
    ONE_WAY: p.oneWay.enabled,
    ROUND_TRIP: p.roundTrip.enabled,
    AIRPORT: p.airport.enabled,
    LOCAL: p.local.enabled,
  }[t];
}

export function acAllowed(p: PricingSettings, isAc: boolean): boolean {
  if (p.acMode === "ac-only") return isAc;
  if (p.acMode === "non-ac-only") return !isAc;
  return true;
}

export function computeBaseFare(p: PricingSettings, i: FareInput): BaseFare {
  const lines: FareLine[] = [];
  const m = Math.max(50, Math.min(500, i.multiplierPct || 100));
  let billableKm = 0;
  let days = 1;
  let hours: number | undefined;

  switch (i.tripType) {
    case "ONE_WAY": {
      const c = p.oneWay;
      const km = Math.max(0, Math.ceil(i.km));
      const rate = mult(i.isAc ? c.acPerKm : c.nonAcPerKm, m);
      billableKm = Math.max(km, c.minKm);
      days = Math.max(1, Math.ceil(i.durationMin / (12 * 60)));
      if (c.baseFare > 0) lines.push({ key: "base", label: "Base fare", amount: mult(c.baseFare, m) });
      lines.push({
        key: "distance",
        label: "Distance charge",
        amount: billableKm * rate,
        hint:
          km < c.minKm
            ? `Minimum ${c.minKm} km × ${formatRate(rate)}/km`
            : `${billableKm} km × ${formatRate(rate)}/km`,
      });
      if (c.driverBata > 0) {
        lines.push({
          key: "bata",
          label: "Driver allowance",
          amount: c.driverBata * days,
          hint: `${days} day${days > 1 ? "s" : ""} × ${formatINR(c.driverBata)}`,
        });
      }
      break;
    }
    case "ROUND_TRIP": {
      const c = p.roundTrip;
      days = Math.max(1, Math.round(i.days ?? 1));
      const km = Math.max(0, Math.ceil(i.km));
      const minKm = c.minKmPerDay * days;
      const rate = mult(i.isAc ? c.acPerKm : c.nonAcPerKm, m);
      billableKm = Math.max(km, minKm);
      lines.push({
        key: "distance",
        label: "Distance charge",
        amount: billableKm * rate,
        hint:
          km < minKm
            ? `Minimum ${c.minKmPerDay} km/day × ${days} day${days > 1 ? "s" : ""} × ${formatRate(rate)}/km`
            : `${billableKm} km × ${formatRate(rate)}/km`,
      });
      if (c.driverBataPerDay > 0) {
        lines.push({
          key: "bata",
          label: "Driver allowance",
          amount: c.driverBataPerDay * days,
          hint: `${days} day${days > 1 ? "s" : ""} × ${formatINR(c.driverBataPerDay)}`,
        });
      }
      break;
    }
    case "AIRPORT": {
      const c = p.airport;
      const km = Math.max(0, Math.ceil(i.km));
      const rate = mult(i.isAc ? c.acPerKm : c.nonAcPerKm, m);
      billableKm = km;
      lines.push({
        key: "base",
        label: "Base fare",
        amount: mult(i.isAc ? c.acBaseFare : c.nonAcBaseFare, m),
        hint: `Includes first ${c.baseKm} km`,
      });
      const extra = Math.max(0, km - c.baseKm);
      if (extra > 0) {
        lines.push({
          key: "extra_km",
          label: "Additional distance",
          amount: extra * rate,
          hint: `${extra} km × ${formatRate(rate)}/km`,
        });
      }
      if (c.airportFee > 0) lines.push({ key: "airport_fee", label: "Airport entry fee", amount: c.airportFee });
      break;
    }
    case "LOCAL": {
      const c = p.local;
      const pkg = c.packages.find((x) => x.id === i.localPackageId) ?? c.packages[0];
      hours = pkg.hours;
      billableKm = pkg.km;
      lines.push({
        key: "package",
        label: `Package · ${pkg.label}`,
        amount: mult(i.isAc ? pkg.acPrice : pkg.nonAcPrice, m),
        hint: `Includes ${pkg.hours} hrs & ${pkg.km} km`,
      });
      if (i.km > pkg.km) {
        const extraKm = Math.ceil(i.km - pkg.km);
        const rate = mult(i.isAc ? c.acExtraPerKm : c.nonAcExtraPerKm, m);
        billableKm = Math.ceil(i.km);
        lines.push({
          key: "extra_km",
          label: "Extra kilometres",
          amount: extraKm * rate,
          hint: `${extraKm} km × ${formatRate(rate)}/km`,
        });
      }
      if (i.actualHours && i.actualHours > pkg.hours) {
        const extraHours = Math.ceil(i.actualHours - pkg.hours);
        hours = Math.ceil(i.actualHours);
        lines.push({
          key: "extra_hours",
          label: "Extra hours",
          amount: extraHours * mult(c.extraPerHour, m),
          hint: `${extraHours} hr × ${formatINR(mult(c.extraPerHour, m))}`,
        });
      }
      break;
    }
  }

  let nightApplied = false;
  const n = p.nightCharge;
  if (n.enabled && n.percent > 0 && isNightHour(i.pickupHour, n.startHour, n.endHour)) {
    const rateBase = lines.filter((l) => RATE_KEYS.has(l.key)).reduce((s, l) => s + l.amount, 0);
    const amount = Math.round((rateBase * n.percent) / 100);
    if (amount > 0) {
      nightApplied = true;
      lines.push({
        key: "night",
        label: `Night charge (${n.percent}%)`,
        amount,
        hint: `Pickup between ${fmtHour(n.startHour)} – ${fmtHour(n.endHour)}`,
      });
    }
  }

  const discountBase = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, discountBase, billableKm, days, hours, nightApplied };
}

function fmtHour(h: number) {
  const suffix = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${suffix}`;
}

/* ----------------------------------------------------------------------------
 * Discounts, tax and rounding
 * ------------------------------------------------------------------------- */

export type PromoDiscount = {
  code: string;
  type: "PERCENT" | "FLAT";
  value: number;
  maxDiscount?: number | null;
};

export type DiscountContext = {
  tier?: { name: string; percent: number; cap: number } | null;
  promo?: PromoDiscount | null;
  referral?: { amount: number } | null;
  credits?: { available: number; maxPercent: number } | null;
};

export function promoAmount(promo: PromoDiscount, base: number): number {
  if (promo.type === "FLAT") return Math.min(promo.value, base);
  const raw = Math.round((base * promo.value) / 100);
  return promo.maxDiscount ? Math.min(raw, promo.maxDiscount) : raw;
}

function finalize(
  p: PricingSettings,
  lines: FareLine[],
  discountBase: number,
  discounts: FareLine[],
  meta: { billableKm: number; days: number; hours?: number },
): FareBreakdown {
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const passThrough = subtotal - discountBase;
  const discountTotal = Math.min(
    discounts.reduce((s, d) => s + d.amount, 0),
    discountBase,
  );
  const taxable = discountBase - discountTotal;
  const tax = p.taxPercent > 0 ? Math.round((taxable * p.taxPercent) / 100) : 0;
  const raw = taxable + tax + passThrough;
  const unit = p.roundTo * 100;
  const total = Math.max(0, Math.round(raw / unit) * unit);
  return {
    lines,
    discounts,
    subtotal,
    discountTotal,
    tax,
    taxPercent: p.taxPercent,
    roundOff: total - raw,
    total,
    billableKm: meta.billableKm,
    days: meta.days,
    hours: meta.hours,
    notes: p.notes,
  };
}

/** Full estimate: base fare → tier discount → promo/referral → reward credits → tax → rounding. */
export function computeEstimate(p: PricingSettings, input: FareInput, ctx: DiscountContext = {}): FareBreakdown {
  const base = computeBaseFare(p, input);
  const discounts: FareLine[] = [];
  let remaining = base.discountBase;

  if (ctx.tier && ctx.tier.percent > 0) {
    const amount = Math.min(Math.round((remaining * ctx.tier.percent) / 100), ctx.tier.cap, remaining);
    if (amount > 0) {
      discounts.push({ key: "tier", label: `${ctx.tier.name} member · ${ctx.tier.percent}% off`, amount });
      remaining -= amount;
    }
  }
  if (ctx.promo) {
    const amount = Math.min(promoAmount(ctx.promo, remaining), remaining);
    if (amount > 0) {
      discounts.push({ key: "promo", label: `Promo ${ctx.promo.code}`, amount });
      remaining -= amount;
    }
  } else if (ctx.referral && ctx.referral.amount > 0) {
    const amount = Math.min(ctx.referral.amount, remaining);
    if (amount > 0) {
      discounts.push({ key: "referral", label: "Referral welcome offer", amount });
      remaining -= amount;
    }
  }
  if (ctx.credits && ctx.credits.available > 0 && ctx.credits.maxPercent > 0) {
    const cap = Math.round((remaining * ctx.credits.maxPercent) / 100);
    const amount = Math.min(ctx.credits.available, cap, remaining);
    if (amount > 0) {
      discounts.push({ key: "credits", label: "Reward credits", amount });
      remaining -= amount;
    }
  }

  return finalize(p, base.lines, base.discountBase, discounts, base);
}

/* ----------------------------------------------------------------------------
 * Final fare at trip completion
 * ------------------------------------------------------------------------- */

export type FinalFareContext = {
  tripType: TripType;
  isAc: boolean;
  multiplierPct: number;
  durationMin: number;
  pickupHour: number;
  localPackageId?: string | null;
  estimate: FareBreakdown;
};

export function computeFinalFare(p: PricingSettings, ctx: FinalFareContext, input: FinalFareInput): FinalFare {
  const km =
    input.actualKm ??
    (ctx.tripType === "LOCAL" ? 0 : ctx.estimate.billableKm);
  const base = computeBaseFare(p, {
    tripType: ctx.tripType,
    isAc: ctx.isAc,
    multiplierPct: ctx.multiplierPct,
    km,
    durationMin: ctx.durationMin,
    pickupHour: ctx.pickupHour,
    days: input.days ?? ctx.estimate.days,
    localPackageId: ctx.localPackageId,
    actualHours: input.actualHours,
  });

  const lines = [...base.lines];
  let discountBase = base.discountBase;
  const add = (key: string, label: string, amount: number | undefined, passThrough: boolean) => {
    if (!amount || amount <= 0) return;
    lines.push({ key, label, amount });
    if (!passThrough) discountBase += amount;
  };
  add("waiting", "Waiting charges", input.waiting, false);
  add("tolls", "Tolls", input.tolls, true);
  add("parking", "Parking", input.parking, true);
  add("permit", "State permit", input.permit, true);
  add("other", input.otherLabel?.trim() || "Other charges", input.other, true);

  const discounts = ctx.estimate.discounts.map((d) => ({ ...d }));
  if (input.extraDiscount && input.extraDiscount > 0) {
    discounts.push({ key: "extra_discount", label: "Courtesy discount", amount: input.extraDiscount });
  }

  let fare = finalize(p, lines, discountBase, discounts, base);
  if (input.overrideTotal !== undefined && input.overrideTotal !== fare.total) {
    const diff = input.overrideTotal - fare.total;
    fare = {
      ...fare,
      lines: [...fare.lines, { key: "adjustment", label: "Fare adjustment", amount: diff }],
      subtotal: fare.subtotal + diff,
      total: input.overrideTotal,
    };
  }
  return { ...fare, input, amountDue: fare.total };
}

/* ----------------------------------------------------------------------------
 * Loyalty
 * ------------------------------------------------------------------------- */

export function tierFor(loyalty: LoyaltySettings, completedRides: number) {
  const sorted = [...loyalty.tiers].sort((a, b) => a.minRides - b.minRides);
  let current = sorted[0];
  for (const t of sorted) if (completedRides >= t.minRides) current = t;
  const next = sorted.find((t) => t.minRides > completedRides) ?? null;
  const progress = next
    ? Math.min(1, (completedRides - current.minRides) / Math.max(1, next.minRides - current.minRides))
    : 1;
  return { current, next, progress, ridesToNext: next ? next.minRides - completedRides : 0 };
}

/** Engagement window used for single-driver conflict detection. */
export function estimatedEngagementMinutes(tripType: TripType, durationMin: number, opts: { returnGapMin?: number; localHours?: number }) {
  switch (tripType) {
    case "ONE_WAY":
      // The driver must also drive back empty.
      return Math.max(60, Math.round(durationMin * 2));
    case "AIRPORT":
      return Math.max(60, Math.round(durationMin + 30));
    case "ROUND_TRIP":
      return Math.max(120, (opts.returnGapMin ?? 0) + Math.round(durationMin));
    case "LOCAL":
      return Math.max(60, (opts.localHours ?? 4) * 60);
  }
}
