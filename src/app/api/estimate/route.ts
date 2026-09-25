import { route } from "@/lib/server/api";
import { estimateTrip } from "@/lib/server/bookings";
import { tripRequestSchema } from "@/lib/validation";

export const POST = route(
  {
    auth: "customer-optional",
    body: tripRequestSchema,
    rateLimit: [{ name: "estimate", limit: 40, windowSec: 300 }],
  },
  async ({ body, customer }) => {
    const est = await estimateTrip(body, customer);
    return {
      fare: est.fare,
      distanceKm: est.route ? Math.round(est.route.distanceMeters / 100) / 10 : null,
      durationMin: est.route ? Math.round(est.route.durationSeconds / 60) : null,
      routeSource: est.route?.source ?? null,
      availability: est.availability,
      promo: est.promo ? { code: est.promo.code, applied: est.promo.applied, message: est.promo.message } : null,
      referralApplied: est.referralApplied,
      tierName: est.tierName,
      vehicle: { id: est.vehicle.id, name: est.vehicle.name, model: est.vehicle.model, seats: est.vehicle.seats },
    };
  },
);
