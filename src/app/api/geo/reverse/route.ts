import { z } from "zod";
import { route } from "@/lib/server/api";
import { reverseGeocode } from "@/lib/server/geo";

export const GET = route(
  {
    query: z.object({
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
    }),
    rateLimit: [{ name: "georev", limit: 20, windowSec: 60, memory: true }],
  },
  async ({ query }) => {
    const place = await reverseGeocode(query.lat, query.lng);
    return { place };
  },
);
