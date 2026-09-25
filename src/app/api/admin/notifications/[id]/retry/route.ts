import { notFound, param, route } from "@/lib/server/api";
import { retryNotification } from "@/lib/server/notify";
import { uuidSchema } from "@/lib/validation";

export const POST = route(
  { auth: "admin", rateLimit: [{ name: "notifretry", limit: 30, windowSec: 600, by: "admin" }] },
  async ({ params }) => {
    const id = uuidSchema.safeParse(param(params, "id"));
    if (!id.success) throw notFound();
    await retryNotification(id.data);
    return { ok: true };
  },
);
