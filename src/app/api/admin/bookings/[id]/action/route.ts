import { notFound, param, route } from "@/lib/server/api";
import { adminActionSchema, performAdminAction } from "@/lib/server/admin-actions";
import { uuidSchema } from "@/lib/validation";

export const POST = route(
  {
    auth: "admin",
    body: adminActionSchema,
    rateLimit: [{ name: "adminact", limit: 120, windowSec: 300, by: "admin" }],
  },
  async ({ admin, params, body, ip, userAgent }) => {
    const id = uuidSchema.safeParse(param(params, "id"));
    if (!id.success) throw notFound();
    const b = await performAdminAction(id.data, body, { type: "ADMIN", id: admin!.id, ip, userAgent });
    return { status: b.status, paymentStatus: b.paymentStatus, finalFare: b.finalFare };
  },
);
