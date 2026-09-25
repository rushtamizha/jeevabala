import { badRequest, route } from "@/lib/server/api";
import { createBooking } from "@/lib/server/bookings";
import { notifyBooking } from "@/lib/server/notify";
import { bookingCreateSchema } from "@/lib/validation";

export const POST = route(
  {
    auth: "customer",
    body: bookingCreateSchema,
    rateLimit: [
      { name: "book:cust", limit: 8, windowSec: 3600, by: "customer" },
      { name: "book:ip", limit: 15, windowSec: 3600 },
    ],
  },
  async ({ body, customer, ip, userAgent }) => {
    // Weak bot signals: filled honeypot or an impossibly fast submission.
    if (body.website) throw badRequest("Invalid request.");
    if (body.startedAt && Date.now() - body.startedAt < 2500) throw badRequest("Please review your booking and try again.");

    // Ride emails always go to the verified account email – never an arbitrary address.
    const input = { ...body, contact: { ...body.contact, email: customer!.email } };
    const { booking, conflicts } = await createBooking(input, customer!, { ip, userAgent });
    await notifyBooking("booking.created", booking.id, { conflicts });
    if (booking.status === "CONFIRMED") await notifyBooking("booking.confirmed", booking.id);
    return { code: booking.code, status: booking.status };
  },
);
