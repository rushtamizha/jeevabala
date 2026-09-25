import { z } from "zod";
import { notFound, route } from "@/lib/server/api";
import { resolvePlace } from "@/lib/server/geo";

export const GET = route(
  {
    query: z.object({
      id: z.string().min(10).max(300),
      session: z
        .string()
        .regex(/^[A-Za-z0-9-]{8,64}$/)
        .optional(),
    }),
    rateLimit: [{ name: "geoplace", limit: 60, windowSec: 60, memory: true }],
  },
  async ({ query }) => {
    const place = await resolvePlace(query.id, query.session);
    if (!place) throw notFound("Place not found.");
    return { place };
  },
);
