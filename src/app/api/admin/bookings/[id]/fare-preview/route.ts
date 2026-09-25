import { notFound, param, route } from "@/lib/server/api";
import { finalFareInputSchema } from "@/lib/server/admin-actions";
import { computeFinalFareFor, getBookingOrThrow } from "@/lib/server/bookings";
import { uuidSchema } from "@/lib/validation";

/** Live preview of the final bill while the driver fills in actual km / tolls. */
export const POST = route(
  { auth: "admin", body: finalFareInputSchema, rateLimit: [{ name: "farepreview", limit: 240, windowSec: 60, by: "admin", memory: true }] },
  async ({ params, body }) => {
    const id = uuidSchema.safeParse(param(params, "id"));
    if (!id.success) throw notFound();
    const b = await getBookingOrThrow(id.data);
    return { fare: await computeFinalFareFor(b, body) };
  },
);
