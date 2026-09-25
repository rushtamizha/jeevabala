import "server-only";
import type { SignedPlace } from "@/lib/types";
import { env } from "./env";
import { sign, verifySignature } from "./keys";

/* ----------------------------------------------------------------------------
 * Signed places – the server signs every geocoded result it hands out, so a
 * client cannot swap in arbitrary coordinates to manipulate fare estimates.
 * ------------------------------------------------------------------------- */

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function placePayload(label: string, lat: number, lng: number) {
  return `${label}|${round6(lat).toFixed(6)}|${round6(lng).toFixed(6)}`;
}

export function signPlace(p: { label: string; secondary?: string; lat: number; lng: number }): SignedPlace {
  const lat = round6(p.lat);
  const lng = round6(p.lng);
  return { label: p.label, secondary: p.secondary, lat, lng, sig: sign("place", placePayload(p.label, lat, lng)) };
}

export function verifyPlace(p: SignedPlace): boolean {
  return verifySignature("place", placePayload(p.label, p.lat, p.lng), p.sig);
}

/* ----------------------------------------------------------------------------
 * Small TTL cache to protect upstream providers (and our quota)
 * ------------------------------------------------------------------------- */

class TtlCache<V> {
  private map = new Map<string, { v: V; exp: number }>();
  constructor(
    private ttlMs: number,
    private max = 2000,
  ) {}
  get(k: string): V | undefined {
    const e = this.map.get(k);
    if (!e) return undefined;
    if (e.exp < Date.now()) {
      this.map.delete(k);
      return undefined;
    }
    return e.v;
  }
  set(k: string, v: V) {
    if (this.map.size >= this.max) {
      const first = this.map.keys().next().value;
      if (first !== undefined) this.map.delete(first);
    }
    this.map.set(k, { v, exp: Date.now() + this.ttlMs });
  }
}

const searchCache = new TtlCache<PlaceSuggestion[]>(10 * 60_000);
const routeCache = new TtlCache<RouteResult>(24 * 60 * 60_000);
const reverseCache = new TtlCache<SignedPlace | null>(60 * 60_000);

const UA = "SaarathiCabs/1.0 (+booking website)";

async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 6000): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, Accept: "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
    redirect: "error",
  });
  if (!res.ok) throw new Error(`Upstream ${new URL(url).host} responded ${res.status}`);
  const text = await res.text();
  if (text.length > 2_000_000) throw new Error("Upstream response too large");
  return JSON.parse(text) as T;
}

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type PlaceSuggestion = {
  /** Present when coordinates are already known (Photon); otherwise resolve via `placeId`. */
  place?: SignedPlace;
  placeId?: string;
  label: string;
  secondary?: string;
  kind?: string;
};

export type RouteResult = { distanceMeters: number; durationSeconds: number; source: "google" | "osrm" | "estimate" };

type Bias = { lat: number; lng: number; countryCode: string };

const provider = () => (env().GOOGLE_MAPS_API_KEY ? "google" : "osm");

/* ----------------------------------------------------------------------------
 * Search / autocomplete
 * ------------------------------------------------------------------------- */

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    postcode?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
  };
};

function photonLabel(p: PhotonFeature["properties"]) {
  const main = p.name ?? [p.housenumber, p.street].filter(Boolean).join(" ") ?? p.city ?? "";
  const secondaryParts = [p.street && p.name ? p.street : undefined, p.locality, p.district, p.city, p.state]
    .filter((x): x is string => Boolean(x) && x !== main)
    .filter((x, i, arr) => arr.indexOf(x) === i);
  return { main: main || secondaryParts.shift() || "Unnamed place", secondary: secondaryParts.slice(0, 3).join(", ") };
}

async function photonSearch(q: string, bias: Bias): Promise<PlaceSuggestion[]> {
  const url = new URL("/api/", env().PHOTON_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "10");
  url.searchParams.set("lang", "en");
  url.searchParams.set("lat", String(bias.lat));
  url.searchParams.set("lon", String(bias.lng));
  const data = await fetchJson<{ features?: PhotonFeature[] }>(url.toString());
  const out: PlaceSuggestion[] = [];
  const seen = new Set<string>();
  for (const f of data.features ?? []) {
    if (bias.countryCode && f.properties.countrycode && f.properties.countrycode.toUpperCase() !== bias.countryCode) {
      continue;
    }
    const [lng, lat] = f.geometry.coordinates;
    const { main, secondary } = photonLabel(f.properties);
    const label = secondary ? `${main}, ${secondary}` : main;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({
      label: main,
      secondary,
      kind: f.properties.osm_value,
      place: signPlace({ label, secondary: undefined, lat, lng }),
    });
    if (out.length >= 6) break;
  }
  return out;
}

async function googleSearch(q: string, bias: Bias, sessionToken?: string): Promise<PlaceSuggestion[]> {
  const body = {
    input: q,
    includedRegionCodes: bias.countryCode ? [bias.countryCode.toLowerCase()] : undefined,
    locationBias: { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 50000 } },
    sessionToken,
    languageCode: "en",
  };
  const data = await fetchJson<{
    suggestions?: {
      placePrediction?: {
        placeId: string;
        text?: { text: string };
        structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
      };
    }[];
  }>("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": env().GOOGLE_MAPS_API_KEY! },
    body: JSON.stringify(body),
  });
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
    .slice(0, 6)
    .map((p) => ({
      placeId: p.placeId,
      label: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "Place",
      secondary: p.structuredFormat?.secondaryText?.text,
    }));
}

export async function searchPlaces(q: string, bias: Bias, sessionToken?: string): Promise<PlaceSuggestion[]> {
  const key = `${provider()}:${bias.countryCode}:${q.toLowerCase()}`;
  const hit = searchCache.get(key);
  if (hit) return hit;
  const results = provider() === "google" ? await googleSearch(q, bias, sessionToken) : await photonSearch(q, bias);
  searchCache.set(key, results);
  return results;
}

/** Resolve a Google place id into signed coordinates. */
export async function resolvePlace(placeId: string, sessionToken?: string): Promise<SignedPlace | null> {
  if (provider() !== "google") return null;
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return null;
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  if (sessionToken) url.searchParams.set("sessionToken", sessionToken);
  const data = await fetchJson<{
    formattedAddress?: string;
    displayName?: { text: string };
    location?: { latitude: number; longitude: number };
  }>(url.toString(), {
    headers: {
      "X-Goog-Api-Key": env().GOOGLE_MAPS_API_KEY!,
      "X-Goog-FieldMask": "displayName,formattedAddress,location",
    },
  });
  if (!data.location) return null;
  const name = data.displayName?.text;
  const addr = data.formattedAddress ?? "";
  const label = name && !addr.startsWith(name) ? `${name}, ${addr}` : addr || name || "Selected place";
  return signPlace({ label, lat: data.location.latitude, lng: data.location.longitude });
}

/* ----------------------------------------------------------------------------
 * Reverse geocoding ("use my location")
 * ------------------------------------------------------------------------- */

export async function reverseGeocode(lat: number, lng: number): Promise<SignedPlace | null> {
  const key = `${provider()}:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = reverseCache.get(key);
  if (hit !== undefined) return hit;
  let result: SignedPlace | null = null;
  try {
    if (provider() === "google") {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("latlng", `${lat},${lng}`);
      url.searchParams.set("key", env().GOOGLE_MAPS_API_KEY!);
      const data = await fetchJson<{ results?: { formatted_address: string }[] }>(url.toString());
      const addr = data.results?.[0]?.formatted_address;
      if (addr) result = signPlace({ label: addr, lat, lng });
    } else {
      const url = new URL("/reverse", env().PHOTON_URL);
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      url.searchParams.set("lang", "en");
      const data = await fetchJson<{ features?: PhotonFeature[] }>(url.toString());
      const f = data.features?.[0];
      if (f) {
        const { main, secondary } = photonLabel(f.properties);
        result = signPlace({ label: secondary ? `${main}, ${secondary}` : main, lat, lng });
      }
    }
  } catch (err) {
    console.warn("[geo] reverse geocode failed:", (err as Error).message);
  }
  if (!result) result = signPlace({ label: `Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`, lat, lng });
  reverseCache.set(key, result);
  return result;
}

/* ----------------------------------------------------------------------------
 * Routing
 * ------------------------------------------------------------------------- */

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function estimateRoute(a: { lat: number; lng: number }, b: { lat: number; lng: number }): RouteResult {
  const straight = haversineKm(a, b);
  const roadKm = straight * (straight < 20 ? 1.4 : 1.25);
  const speed = roadKm < 25 ? 24 : roadKm < 80 ? 40 : 52; // km/h – city vs highway
  return {
    distanceMeters: Math.round(roadKm * 1000),
    durationSeconds: Math.round((roadKm / speed) * 3600),
    source: "estimate",
  };
}

async function osrmRoute(a: { lat: number; lng: number }, b: { lat: number; lng: number }): Promise<RouteResult> {
  const coords = `${a.lng.toFixed(6)},${a.lat.toFixed(6)};${b.lng.toFixed(6)},${b.lat.toFixed(6)}`;
  const url = new URL(`/route/v1/driving/${coords}`, env().OSRM_URL);
  url.searchParams.set("overview", "false");
  url.searchParams.set("alternatives", "false");
  const data = await fetchJson<{ code: string; routes?: { distance: number; duration: number }[] }>(url.toString());
  const r = data.routes?.[0];
  if (data.code !== "Ok" || !r) throw new Error(`OSRM: ${data.code}`);
  // Public OSRM durations are optimistic for Indian roads; pad by 20%.
  return { distanceMeters: Math.round(r.distance), durationSeconds: Math.round(r.duration * 1.2), source: "osrm" };
}

async function googleRoute(a: { lat: number; lng: number }, b: { lat: number; lng: number }): Promise<RouteResult> {
  const data = await fetchJson<{ routes?: { distanceMeters?: number; duration?: string }[] }>(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env().GOOGLE_MAPS_API_KEY!,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: a.lat, longitude: a.lng } } },
        destination: { location: { latLng: { latitude: b.lat, longitude: b.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
      }),
    },
  );
  const r = data.routes?.[0];
  if (!r?.distanceMeters || !r.duration) throw new Error("Google Routes: no route");
  return { distanceMeters: r.distanceMeters, durationSeconds: Number.parseInt(r.duration, 10), source: "google" };
}

export async function getRoute(a: { lat: number; lng: number }, b: { lat: number; lng: number }): Promise<RouteResult> {
  const key = `${a.lat.toFixed(5)},${a.lng.toFixed(5)}>${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;
  const hit = routeCache.get(key);
  if (hit) return hit;
  let result: RouteResult;
  try {
    result = provider() === "google" ? await googleRoute(a, b) : await osrmRoute(a, b);
  } catch (err) {
    console.warn("[geo] routing failed, using straight-line estimate:", (err as Error).message);
    // Not cached: the upstream may recover on the next request.
    return estimateRoute(a, b);
  }
  routeCache.set(key, result);
  return result;
}
