import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, reviews, rewardTransactions, savedPlaces } from "@/db/schema";
import { route } from "@/lib/server/api";

/** Operational/security fields that are not personal data of the customer. */
const INTERNAL_FIELDS = new Set(["clientIp", "userAgent", "adminNote", "ridePin"]);

/** Data portability (DPDP Act / GDPR): a machine-readable copy of the customer's data. */
export const GET = route(
  { auth: "customer", rateLimit: [{ name: "export", limit: 5, windowSec: 3600, by: "customer" }] },
  async ({ customer }) => {
    const c = customer!;
    const [rides, places, rev, rewards] = await Promise.all([
      db.select().from(bookings).where(eq(bookings.customerId, c.id)).orderBy(desc(bookings.createdAt)),
      db.select().from(savedPlaces).where(eq(savedPlaces.customerId, c.id)),
      db.select().from(reviews).where(eq(reviews.customerId, c.id)),
      db.select().from(rewardTransactions).where(eq(rewardTransactions.customerId, c.id)),
    ]);
    const data = {
      exportedAt: new Date().toISOString(),
      profile: { name: c.name, email: c.email, phone: c.phone, referralCode: c.referralCode, rewardBalancePaise: c.rewardBalance, createdAt: c.createdAt },
      bookings: rides.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !INTERNAL_FIELDS.has(k)))),
      savedPlaces: places,
      reviews: rev,
      rewardTransactions: rewards,
    };
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  },
);
