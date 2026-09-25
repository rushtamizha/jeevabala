import { z } from "zod";
import { param, route, unprocessable } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { canCustomerCancel, transitionBooking } from "@/lib/server/bookings";
import { getOwnBooking } from "@/lib/server/customer-bookings";
import { notifyBooking } from "@/lib/server/notify";
import { getSettings } from "@/lib/server/settings";
import { safeText } from "@/lib/validation";

export const POST = route(
  {
    auth: "customer",
    body: z.object({ reason: safeText(200).optional() }),
    rateLimit: [{ name: "cancel", limit: 10, windowSec: 3600, by: "customer" }],
  },
  async ({ customer, params, body, ip, userAgent }) => {
    const b = await getOwnBooking(customer!.id, param(params, "code"));
    const s = await getSettings();
    const policy = canCustomerCancel(b, s);
    if (!policy.ok) throw unprocessable(policy.reason!);
    const updated = await transitionBooking(b.id, b.status, "CANCELLED", {
      actor: "CUSTOMER",
      actorId: customer!.id,
      reason: body.reason || "Cancelled by customer",
    });
    await audit({ actorType: "CUSTOMER", actorId: customer!.id, action: "booking.cancel", entityType: "booking", entityId: b.id, ip, userAgent });
    await notifyBooking("booking.cancelled", updated.id, { cancelledBy: "CUSTOMER", reason: body.reason });
    return { status: updated.status };
  },
);
