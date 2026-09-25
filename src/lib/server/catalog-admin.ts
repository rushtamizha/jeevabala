import "server-only";
import type { CityInput, RouteInput, TestimonialInput, VehicleInput } from "@/lib/admin-schemas";

const blank = <T,>(v: T | undefined | null | "") => (v === undefined || v === null || v === "" ? null : v);

/** Map validated admin input to DB rows (empty strings → NULL, rates cleaned). */
export function normalizeVehicle(v: VehicleInput) {
  const rates = Object.fromEntries(Object.entries(v.rates ?? {}).filter(([, x]) => typeof x === "number" && x > 0));
  return {
    ...v,
    slug: blank(v.slug),
    model: blank(v.model),
    description: blank(v.description),
    plateNumber: blank(v.plateNumber),
    color: blank(v.color),
    imageUrl: blank(v.imageUrl),
    rates,
  };
}

export function normalizeCity(c: CityInput) {
  return { ...c, district: blank(c.district), intro: blank(c.intro), airportName: blank(c.airportName), imageUrl: blank(c.imageUrl), metaTitle: blank(c.metaTitle), metaDescription: blank(c.metaDescription) };
}

export function normalizeRoute(r: RouteInput) {
  return { ...r, fromCityId: r.fromCityId ?? null, toCityId: r.toCityId ?? null, description: blank(r.description), metaTitle: blank(r.metaTitle), metaDescription: blank(r.metaDescription) };
}

export function normalizeTestimonial(t: TestimonialInput) {
  return { ...t, location: blank(t.location), avatarUrl: blank(t.avatarUrl), tripLabel: blank(t.tripLabel), source: blank(t.source) };
}

/** Postgres unique_violation → friendly 409 instead of a 500. */
export async function uniqueGuard<T>(fn: () => Promise<T>, message: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const code = (err as { code?: string; cause?: { code?: string } }).code ?? (err as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") {
      const { conflict } = await import("./api");
      throw conflict(message);
    }
    throw err;
  }
}
