import { and, count, desc, eq, gt, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { admins, bookingEvents, bookings } from "@/db/schema";
import { route } from "@/lib/server/api";

/** Polled by the admin shell for real-time alerts (new requests, payments, cancellations). */
export const GET = route(
  { auth: "admin", rateLimit: [{ name: "adminlive", limit: 60, windowSec: 60, by: "admin", memory: true }] },
  async ({ admin, req }) => {
    const markSeen = req.nextUrl.searchParams.get("seen") === "1";
    const [[pending], [claims], alerts] = await Promise.all([
      db.select({ n: count() }).from(bookings).where(eq(bookings.status, "PENDING")),
      db.select({ n: count() }).from(bookings).where(eq(bookings.paymentStatus, "CLAIMED")),
      db
        .select({
          id: bookingEvents.id,
          bookingId: bookingEvents.bookingId,
          code: bookings.code,
          type: bookingEvents.type,
          message: bookingEvents.message,
          createdAt: bookingEvents.createdAt,
          name: bookings.contactName,
        })
        .from(bookingEvents)
        .innerJoin(bookings, eq(bookingEvents.bookingId, bookings.id))
        .where(and(inArray(bookingEvents.actor, ["CUSTOMER", "SYSTEM"]), ne(bookingEvents.type, "NOTE")))
        .orderBy(desc(bookingEvents.createdAt))
        .limit(15),
    ]);
    const seenAt = admin!.alertsSeenAt;
    const unread = alerts.filter((a) => a.createdAt > seenAt).length;
    if (markSeen) await db.update(admins).set({ alertsSeenAt: new Date() }).where(eq(admins.id, admin!.id));
    const [latest] = await db
      .select({ at: bookingEvents.createdAt })
      .from(bookingEvents)
      .where(gt(bookingEvents.createdAt, new Date(0)))
      .orderBy(desc(bookingEvents.createdAt))
      .limit(1);
    return {
      pending: Number(pending?.n ?? 0),
      paymentClaims: Number(claims?.n ?? 0),
      unread: markSeen ? 0 : unread,
      latestEventAt: latest?.at?.toISOString() ?? null,
      alerts: alerts.map((a) => ({ ...a, createdAt: a.createdAt.toISOString(), unread: a.createdAt > seenAt })),
    };
  },
);
