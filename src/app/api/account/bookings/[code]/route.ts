import { param, route } from "@/lib/server/api";
import { getOwnBooking } from "@/lib/server/customer-bookings";

/** Lightweight status snapshot for live polling on the booking page. */
export const GET = route(
  { auth: "customer", rateLimit: [{ name: "poll:cust", limit: 120, windowSec: 60, by: "customer", memory: true }] },
  async ({ customer, params }) => {
    const b = await getOwnBooking(customer!.id, param(params, "code"));
    return { status: b.status, paymentStatus: b.paymentStatus, updatedAt: b.updatedAt.toISOString() };
  },
);
