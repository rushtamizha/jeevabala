import "server-only";
import { and, desc, eq, inArray, sum } from "drizzle-orm";
import { db } from "@/db";
import { bookings, customers, rewardTransactions, type Customer } from "@/db/schema";
import { tierFor } from "@/lib/pricing";
import { ACTIVE_STATUSES } from "@/lib/types";
import { absoluteUrl } from "./env";
import { getSettings } from "./settings";

export type BookingListItem = {
  code: string;
  status: (typeof bookings.$inferSelect)["status"];
  paymentStatus: (typeof bookings.$inferSelect)["paymentStatus"];
  tripType: (typeof bookings.$inferSelect)["tripType"];
  pickupAddress: string;
  dropAddress: string | null;
  pickupAt: string;
  amount: number;
  isAc: boolean;
  vehicleName: string;
};

function toItem(b: typeof bookings.$inferSelect): BookingListItem {
  return {
    code: b.code,
    status: b.status,
    paymentStatus: b.paymentStatus,
    tripType: b.tripType,
    pickupAddress: b.pickupAddress,
    dropAddress: b.dropAddress,
    pickupAt: b.pickupAt.toISOString(),
    amount: b.finalFare ?? b.quotedFare ?? b.fareEstimate,
    isAc: b.isAc,
    vehicleName: b.vehicleName,
  };
}

export async function listCustomerBookings(customerId: string, limit = 50) {
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.customerId, customerId))
    .orderBy(desc(bookings.pickupAt))
    .limit(limit);
  return rows.map(toItem);
}

export async function getAccountOverview(customer: Customer) {
  const s = await getSettings();
  const [recent, active, [spent], [saved], txns, referred] = await Promise.all([
    db.select().from(bookings).where(eq(bookings.customerId, customer.id)).orderBy(desc(bookings.createdAt)).limit(5),
    db
      .select()
      .from(bookings)
      .where(and(eq(bookings.customerId, customer.id), inArray(bookings.status, ACTIVE_STATUSES)))
      .orderBy(bookings.pickupAt)
      .limit(3),
    db
      .select({ total: sum(bookings.finalFare) })
      .from(bookings)
      .where(and(eq(bookings.customerId, customer.id), eq(bookings.paymentStatus, "PAID"))),
    db
      .select({ total: sum(bookings.discountTotal) })
      .from(bookings)
      .where(and(eq(bookings.customerId, customer.id), eq(bookings.status, "COMPLETED"))),
    db
      .select()
      .from(rewardTransactions)
      .where(eq(rewardTransactions.customerId, customer.id))
      .orderBy(desc(rewardTransactions.createdAt))
      .limit(8),
    db.select({ id: customers.id }).from(customers).where(eq(customers.referredById, customer.id)),
  ]);
  const completed = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.customerId, customer.id), eq(bookings.status, "COMPLETED")));
  const unpaid = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.customerId, customer.id), eq(bookings.status, "COMPLETED"), eq(bookings.paymentStatus, "UNPAID")))
    .limit(3);
  const loyalty = tierFor(s.loyalty, completed.length);
  return {
    recent: recent.map(toItem),
    active: active.map(toItem),
    unpaid: unpaid.map(toItem),
    stats: {
      completedRides: completed.length,
      totalSpent: Number(spent?.total ?? 0),
      totalSaved: Number(saved?.total ?? 0),
      credits: customer.rewardBalance,
      friendsReferred: referred.length,
    },
    loyalty: {
      enabled: s.loyalty.enabled,
      current: loyalty.current,
      next: loyalty.next,
      progress: loyalty.progress,
      ridesToNext: loyalty.ridesToNext,
      tiers: [...s.loyalty.tiers].sort((a, b) => a.minRides - b.minRides),
    },
    referral: {
      enabled: s.loyalty.enabled && s.loyalty.referral.enabled,
      code: customer.referralCode,
      link: absoluteUrl(`/?ref=${customer.referralCode}`),
      refereeDiscount: s.loyalty.referral.refereeDiscount,
      referrerBonus: s.loyalty.referral.referrerBonus,
    },
    rewards: txns.map((t) => ({ id: t.id, type: t.type, amount: t.amount, note: t.note, createdAt: t.createdAt.toISOString() })),
    timezone: s.business.timezone,
    brand: s.business.name,
  };
}
