import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { savedPlaces } from "@/db/schema";
import { badRequest, route, unprocessable } from "@/lib/server/api";
import { verifyPlace } from "@/lib/server/geo";
import { safeText, signedPlaceSchema } from "@/lib/validation";

export const POST = route(
  {
    auth: "customer",
    body: z.object({ label: safeText(30, 1), place: signedPlaceSchema }),
    rateLimit: [{ name: "places", limit: 30, windowSec: 3600, by: "customer" }],
  },
  async ({ customer, body }) => {
    if (!verifyPlace(body.place)) throw badRequest("Location could not be verified.");
    const [n] = await db.select({ n: count() }).from(savedPlaces).where(eq(savedPlaces.customerId, customer!.id));
    if (Number(n?.n ?? 0) >= 10) throw unprocessable("You can save up to 10 places.");
    const [created] = await db
      .insert(savedPlaces)
      .values({ customerId: customer!.id, label: body.label, address: body.place.label, lat: body.place.lat, lng: body.place.lng })
      .returning();
    return { id: created.id };
  },
);
