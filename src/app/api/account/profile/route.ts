import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { route } from "@/lib/server/api";
import { personName, phoneSchema } from "@/lib/validation";

export const PATCH = route(
  {
    auth: "customer",
    body: z.object({
      name: personName.optional(),
      phone: phoneSchema.optional(),
      marketingOptIn: z.boolean().optional(),
      whatsappOptIn: z.boolean().optional(),
    }),
    rateLimit: [{ name: "profile", limit: 30, windowSec: 3600, by: "customer" }],
  },
  async ({ customer, body }) => {
    const [updated] = await db.update(customers).set(body).where(eq(customers.id, customer!.id)).returning();
    return { name: updated.name, phone: updated.phone, marketingOptIn: updated.marketingOptIn, whatsappOptIn: updated.whatsappOptIn };
  },
);
