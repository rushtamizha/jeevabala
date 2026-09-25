import { z } from "zod";
import { db } from "@/db";
import { blackouts } from "@/db/schema";
import { route, unprocessable } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { getSetting } from "@/lib/server/settings";
import { wallTimeToUtc } from "@/lib/time";
import { safeText, wallTimeSchema } from "@/lib/validation";

export const POST = route(
  { auth: "admin", body: z.object({ startsAt: wallTimeSchema, endsAt: wallTimeSchema, reason: safeText(120).optional() }) },
  async ({ admin, body, ip, userAgent }) => {
    const tz = (await getSetting("business")).timezone;
    const startsAt = wallTimeToUtc(body.startsAt, tz);
    const endsAt = wallTimeToUtc(body.endsAt, tz);
    if (endsAt <= startsAt) throw unprocessable("End must be after start.");
    const [row] = await db.insert(blackouts).values({ startsAt, endsAt, reason: body.reason || null }).returning();
    await audit({ actorType: "ADMIN", actorId: admin!.id, action: "blackout.create", entityType: "blackout", entityId: row.id, ip, userAgent });
    return { id: row.id };
  },
);
