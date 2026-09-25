import { z } from "zod";
import { route } from "@/lib/server/api";
import { searchPlaces } from "@/lib/server/geo";
import { getSetting } from "@/lib/server/settings";

export const GET = route(
  {
    query: z.object({
      q: z.string().trim().min(2).max(120),
      session: z
        .string()
        .regex(/^[A-Za-z0-9-]{8,64}$/)
        .optional(),
    }),
    rateLimit: [
      { name: "geo:m", limit: 90, windowSec: 60, memory: true },
      { name: "geo:h", limit: 1500, windowSec: 3600 },
    ],
  },
  async ({ query }) => {
    const b = await getSetting("business");
    try {
      const results = await searchPlaces(query.q, { lat: b.serviceLat, lng: b.serviceLng, countryCode: b.countryCode }, query.session);
      return { results };
    } catch (err) {
      console.warn("[geo] search failed:", (err as Error).message);
      return { results: [], degraded: true };
    }
  },
);
