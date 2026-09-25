import "server-only";
import { and, asc, avg, count, desc, eq, gte, ilike, inArray, isNull, lt, lte, max, ne, or, sql, sum, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  admins,
  auditLogs,
  blackouts,
  bookingEvents,
  bookings,
  customers,
  notifications,
  promoCodes,
  reviews,
  vehicles,
} from "@/db/schema";
import { tierFor } from "@/lib/pricing";
import { utcToWallTime, wallDate, wallTimeToUtc } from "@/lib/time";
import { ACTIVE_STATUSES, ENGAGED_STATUSES, type BookingStatus } from "@/lib/types";
import { conflictsFor } from "./bookings";
import { getIntegrations, getSettings } from "./settings";

const PAGE_SIZE = 25;

function dayBounds(tz: string, offsetDays = 0) {
  const today = wallDate(new Date(), tz);
  const start = wallTimeToUtc(`${today}T00:00`, tz);
  const s = new Date(start.getTime() + offsetDays * 86_400_000);
  return { start: s, end: new Date(s.getTime() + 86_400_000) };
}

/* ----------------------------------------------------------------------------
 * Dashboard
 * ------------------------------------------------------------------------- */

export async function getDashboard() {
  const s = await getSettings();
  const tz = s.business.timezone;
  const { start: todayStart, end: todayEnd } = dayBounds(tz);
  const monthStart = wallTimeToUtc(`${wallDate(new Date(), tz).slice(0, 8)}01T00:00`, tz);
  const prevMonthStart = (() => {
    const d = new Date(monthStart.getTime() - 86_400_000);
    return wallTimeToUtc(`${wallDate(d, tz).slice(0, 8)}01T00:00`, tz);
  })();
  const since30 = new Date(todayStart.getTime() - 29 * 86_400_000);

  const [
    [today],
    [pending],
    [month],
    [prevMonth],
    [outstanding],
    [rating],
    [customerCount],
    [newCustomers],
    [allTime],
    pendingList,
    claims,
    upcoming,
    revenueRows,
    tripSplit,
    funnel,
    activity,
  ] = await Promise.all([
    db
      .select({ n: count() })
      .from(bookings)
      .where(and(gte(bookings.pickupAt, todayStart), lt(bookings.pickupAt, todayEnd), inArray(bookings.status, [...ENGAGED_STATUSES, "COMPLETED"]))),
    db.select({ n: count() }).from(bookings).where(eq(bookings.status, "PENDING")),
    db
      .select({ revenue: sum(bookings.finalFare), rides: count() })
      .from(bookings)
      .where(and(eq(bookings.status, "COMPLETED"), gte(bookings.completedAt, monthStart))),
    db
      .select({ revenue: sum(bookings.finalFare), rides: count() })
      .from(bookings)
      .where(and(eq(bookings.status, "COMPLETED"), gte(bookings.completedAt, prevMonthStart), lt(bookings.completedAt, monthStart))),
    db
      .select({ amount: sum(bookings.finalFare), n: count() })
      .from(bookings)
      .where(and(eq(bookings.status, "COMPLETED"), inArray(bookings.paymentStatus, ["UNPAID", "CLAIMED"]))),
    db.select({ avg: avg(reviews.rating), n: count() }).from(reviews),
    db.select({ n: count() }).from(customers).where(isNull(customers.deletedAt)),
    db.select({ n: count() }).from(customers).where(gte(customers.createdAt, monthStart)),
    db.select({ revenue: sum(bookings.finalFare), rides: count() }).from(bookings).where(eq(bookings.paymentStatus, "PAID")),
    db.select().from(bookings).where(eq(bookings.status, "PENDING")).orderBy(asc(bookings.pickupAt)).limit(6),
    db.select().from(bookings).where(eq(bookings.paymentStatus, "CLAIMED")).orderBy(desc(bookings.paymentClaimedAt)).limit(6),
    db
      .select()
      .from(bookings)
      .where(and(inArray(bookings.status, ENGAGED_STATUSES), gte(bookings.estimatedEndAt, new Date())))
      .orderBy(asc(bookings.pickupAt))
      .limit(8),
    db
      .select({
        day: sql<string>`to_char(${bookings.completedAt} at time zone ${tz}, 'YYYY-MM-DD')`,
        revenue: sum(bookings.finalFare),
        rides: count(),
      })
      .from(bookings)
      .where(and(eq(bookings.status, "COMPLETED"), gte(bookings.completedAt, since30)))
      .groupBy(sql`1`),
    db
      .select({ tripType: bookings.tripType, n: count(), revenue: sum(bookings.finalFare) })
      .from(bookings)
      .where(eq(bookings.status, "COMPLETED"))
      .groupBy(bookings.tripType),
    db
      .select({ status: bookings.status, n: count() })
      .from(bookings)
      .where(gte(bookings.createdAt, since30))
      .groupBy(bookings.status),
    db
      .select({
        id: bookingEvents.id,
        bookingId: bookingEvents.bookingId,
        code: bookings.code,
        message: bookingEvents.message,
        actor: bookingEvents.actor,
        createdAt: bookingEvents.createdAt,
      })
      .from(bookingEvents)
      .innerJoin(bookings, eq(bookingEvents.bookingId, bookings.id))
      .orderBy(desc(bookingEvents.createdAt))
      .limit(10),
  ]);

  // Fill 30-day series.
  const byDay = new Map(revenueRows.map((r) => [r.day, r]));
  const series = Array.from({ length: 30 }, (_, i) => {
    const d = wallDate(new Date(since30.getTime() + i * 86_400_000 + 12 * 3_600_000), tz);
    const r = byDay.get(d);
    return { day: d, revenue: Number(r?.revenue ?? 0) / 100, rides: Number(r?.rides ?? 0) };
  });

  const integ = await getIntegrations();
  const [vehicleCount] = await db.select({ n: count() }).from(vehicles).where(eq(vehicles.isActive, true));
  const [adminRow] = await db.select({ totp: admins.totpEnabled }).from(admins).limit(1);
  const checklist = [
    { key: "business", label: "Add your phone & WhatsApp number", done: Boolean(s.business.phone), href: "/admin/settings" },
    { key: "upi", label: "Add your UPI ID to receive payments", done: Boolean(s.payment.upiId), href: "/admin/settings?tab=payment" },
    { key: "smtp", label: "Connect email (required for customer verification)", done: integ.smtp.configured, href: "/admin/settings/integrations" },
    { key: "telegram", label: "Connect Telegram for instant ride alerts", done: integ.telegram.configured, href: "/admin/settings/integrations" },
    { key: "whatsapp", label: "Connect WhatsApp notifications", done: integ.whatsapp.configured, href: "/admin/settings/integrations" },
    { key: "fleet", label: "Review your vehicle details", done: Number(vehicleCount?.n ?? 0) > 0, href: "/admin/fleet" },
    { key: "2fa", label: "Enable two-factor authentication", done: Boolean(adminRow?.totp), href: "/admin/security" },
  ];

  const monthRevenue = Number(month?.revenue ?? 0);
  const prevRevenue = Number(prevMonth?.revenue ?? 0);
  return {
    tz,
    kpis: {
      todayRides: Number(today?.n ?? 0),
      pending: Number(pending?.n ?? 0),
      monthRevenue,
      monthRides: Number(month?.rides ?? 0),
      revenueDelta: prevRevenue > 0 ? Math.round(((monthRevenue - prevRevenue) / prevRevenue) * 100) : null,
      outstanding: Number(outstanding?.amount ?? 0),
      outstandingCount: Number(outstanding?.n ?? 0),
      avgRating: rating?.avg ? Math.round(Number(rating.avg) * 10) / 10 : null,
      reviewCount: Number(rating?.n ?? 0),
      customers: Number(customerCount?.n ?? 0),
      newCustomers: Number(newCustomers?.n ?? 0),
      lifetimeRevenue: Number(allTime?.revenue ?? 0),
      lifetimeRides: Number(allTime?.rides ?? 0),
    },
    pendingList,
    claims,
    upcoming,
    series,
    tripSplit: tripSplit.map((t) => ({ tripType: t.tripType, rides: Number(t.n), revenue: Number(t.revenue ?? 0) })),
    funnel: funnel.map((f) => ({ status: f.status, n: Number(f.n) })),
    activity,
    checklist,
    accepting: s.booking.acceptingBookings,
  };
}

/* ----------------------------------------------------------------------------
 * Bookings list
 * ------------------------------------------------------------------------- */

export const BOOKING_TABS = {
  pending: ["PENDING"],
  upcoming: ["CONFIRMED", "EN_ROUTE", "ARRIVED"],
  live: ["IN_PROGRESS"],
  completed: ["COMPLETED"],
  cancelled: ["CANCELLED", "REJECTED"],
  all: null,
} as const satisfies Record<string, BookingStatus[] | null>;

export type BookingTab = keyof typeof BOOKING_TABS;

export async function listBookings(opts: { tab: BookingTab; q?: string; page: number; unpaid?: boolean }) {
  const conds: SQL[] = [];
  const statuses = BOOKING_TABS[opts.tab];
  if (statuses) conds.push(inArray(bookings.status, [...statuses]));
  if (opts.unpaid) conds.push(inArray(bookings.paymentStatus, ["UNPAID", "CLAIMED"]));
  if (opts.q) {
    const q = `%${opts.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conds.push(
      or(
        ilike(bookings.code, q),
        ilike(bookings.contactName, q),
        ilike(bookings.contactPhone, q),
        ilike(bookings.contactEmail, q),
        ilike(bookings.pickupAddress, q),
        ilike(bookings.dropAddress, q),
      )!,
    );
  }
  const where = conds.length ? and(...conds) : undefined;
  const order =
    opts.tab === "pending" || opts.tab === "upcoming" || opts.tab === "live" ? asc(bookings.pickupAt) : desc(bookings.pickupAt);
  const [rows, [total], counts] = await Promise.all([
    db
      .select()
      .from(bookings)
      .where(where)
      .orderBy(order)
      .limit(PAGE_SIZE)
      .offset((opts.page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(bookings).where(where),
    db.select({ status: bookings.status, n: count() }).from(bookings).groupBy(bookings.status),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])) as Partial<Record<BookingStatus, number>>;
  const tabCounts = Object.fromEntries(
    Object.entries(BOOKING_TABS).map(([k, v]) => [k, v ? v.reduce((s, st) => s + (byStatus[st] ?? 0), 0) : Object.values(byStatus).reduce((a, b) => a + (b ?? 0), 0)]),
  ) as Record<BookingTab, number>;
  return { rows, total: Number(total?.n ?? 0), pageSize: PAGE_SIZE, tabCounts };
}

/* ----------------------------------------------------------------------------
 * Booking detail
 * ------------------------------------------------------------------------- */

export async function getBookingAdmin(id: string) {
  const [row] = await db
    .select({ booking: bookings, customer: customers, vehicle: vehicles })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .leftJoin(vehicles, eq(bookings.vehicleId, vehicles.id))
    .where(eq(bookings.id, id))
    .limit(1);
  if (!row) return null;
  const s = await getSettings();
  const [events, notes, conflicts, [history], [review]] = await Promise.all([
    db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, id)).orderBy(desc(bookingEvents.createdAt)),
    db
      .select({
        id: notifications.id,
        channel: notifications.channel,
        audience: notifications.audience,
        event: notifications.event,
        status: notifications.status,
        lastError: notifications.lastError,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.bookingId, id))
      .orderBy(desc(notifications.createdAt))
      .limit(30),
    ACTIVE_STATUSES.includes(row.booking.status) ? conflictsFor(row.booking) : Promise.resolve([]),
    db
      .select({ rides: count(), spent: sum(bookings.finalFare) })
      .from(bookings)
      .where(and(eq(bookings.customerId, row.customer.id), eq(bookings.status, "COMPLETED"))),
    db.select().from(reviews).where(eq(reviews.bookingId, id)).limit(1),
  ]);
  const rides = Number(history?.rides ?? 0);
  return {
    ...row,
    events,
    notifications: notes,
    conflicts,
    review: review ?? null,
    customerStats: { rides, spent: Number(history?.spent ?? 0), tier: tierFor(s.loyalty, rides).current.name },
    settings: {
      tz: s.business.timezone,
      requireRidePin: s.booking.requireRidePin,
      upiId: s.payment.upiId,
      payeeName: s.payment.payeeName || s.business.name,
      brand: s.business.name,
      local: s.pricing.local,
    },
  };
}

/* ----------------------------------------------------------------------------
 * Customers
 * ------------------------------------------------------------------------- */

export async function listCustomers(opts: { q?: string; page: number }) {
  const conds: SQL[] = [isNull(customers.deletedAt)];
  if (opts.q) {
    const q = `%${opts.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conds.push(or(ilike(customers.name, q), ilike(customers.email, q), ilike(customers.phone, q))!);
  }
  const where = and(...conds);
  const stats = db
    .select({
      customerId: bookings.customerId,
      rides: sql<number>`count(*) filter (where ${bookings.status} = 'COMPLETED')`.as("rides"),
      spent: sql<number>`coalesce(sum(${bookings.finalFare}) filter (where ${bookings.paymentStatus} = 'PAID'), 0)`.as("spent"),
      lastRide: max(bookings.pickupAt).as("last_ride"),
      total: count().as("total"),
    })
    .from(bookings)
    .groupBy(bookings.customerId)
    .as("stats");
  const [rows, [total]] = await Promise.all([
    db
      .select({ customer: customers, rides: stats.rides, spent: stats.spent, lastRide: stats.lastRide, total: stats.total })
      .from(customers)
      .leftJoin(stats, eq(stats.customerId, customers.id))
      .where(where)
      .orderBy(desc(sql`coalesce(${stats.lastRide}, ${customers.createdAt})`))
      .limit(PAGE_SIZE)
      .offset((opts.page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(customers).where(where),
  ]);
  return {
    rows: rows.map((r) => ({
      ...r.customer,
      rides: Number(r.rides ?? 0),
      spent: Number(r.spent ?? 0),
      lastRide: r.lastRide,
      totalBookings: Number(r.total ?? 0),
    })),
    total: Number(total?.n ?? 0),
    pageSize: PAGE_SIZE,
  };
}

export async function getCustomerAdmin(id: string) {
  const [c] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!c) return null;
  const s = await getSettings();
  const [rows, [agg], referrals] = await Promise.all([
    db.select().from(bookings).where(eq(bookings.customerId, id)).orderBy(desc(bookings.pickupAt)).limit(100),
    db
      .select({ rides: count(), spent: sum(bookings.finalFare) })
      .from(bookings)
      .where(and(eq(bookings.customerId, id), eq(bookings.status, "COMPLETED"))),
    db.select({ id: customers.id, name: customers.name }).from(customers).where(eq(customers.referredById, id)),
  ]);
  const rides = Number(agg?.rides ?? 0);
  return {
    customer: c,
    bookings: rows,
    stats: { rides, spent: Number(agg?.spent ?? 0), tier: tierFor(s.loyalty, rides).current.name },
    referrals,
    tz: s.business.timezone,
  };
}

/* ----------------------------------------------------------------------------
 * Payments, reviews, promos, schedule, audit
 * ------------------------------------------------------------------------- */

export async function listPayments(tab: "outstanding" | "claims" | "received") {
  const where =
    tab === "claims"
      ? and(eq(bookings.status, "COMPLETED"), eq(bookings.paymentStatus, "CLAIMED"))
      : tab === "outstanding"
        ? and(eq(bookings.status, "COMPLETED"), inArray(bookings.paymentStatus, ["UNPAID", "CLAIMED"]))
        : and(eq(bookings.status, "COMPLETED"), inArray(bookings.paymentStatus, ["PAID", "WAIVED"]));
  const [rows, [totals], byMethod] = await Promise.all([
    db
      .select()
      .from(bookings)
      .where(where)
      .orderBy(desc(tab === "received" ? bookings.paidAt : bookings.completedAt))
      .limit(100),
    db.select({ amount: sum(bookings.finalFare), n: count() }).from(bookings).where(where),
    db
      .select({ method: bookings.paymentMethod, amount: sum(bookings.finalFare), n: count() })
      .from(bookings)
      .where(eq(bookings.paymentStatus, "PAID"))
      .groupBy(bookings.paymentMethod),
  ]);
  return {
    rows,
    total: Number(totals?.amount ?? 0),
    count: Number(totals?.n ?? 0),
    byMethod: byMethod.map((m) => ({ method: m.method ?? "OTHER", amount: Number(m.amount ?? 0), n: Number(m.n) })),
  };
}

export async function listReviewsAdmin() {
  return db
    .select({ review: reviews, name: customers.name, code: bookings.code, bookingId: bookings.id })
    .from(reviews)
    .innerJoin(customers, eq(reviews.customerId, customers.id))
    .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
    .orderBy(desc(reviews.createdAt))
    .limit(200);
}

export async function listPromosAdmin() {
  const usage = db
    .select({ promoId: bookings.promoCodeId, used: count().as("used") })
    .from(bookings)
    .where(and(sql`${bookings.promoCodeId} is not null`, ne(bookings.status, "CANCELLED"), ne(bookings.status, "REJECTED")))
    .groupBy(bookings.promoCodeId)
    .as("usage");
  const rows = await db
    .select({ promo: promoCodes, used: usage.used })
    .from(promoCodes)
    .leftJoin(usage, eq(usage.promoId, promoCodes.id))
    .orderBy(desc(promoCodes.createdAt));
  return rows.map((r) => ({ ...r.promo, used: Number(r.used ?? 0) }));
}

export async function getSchedule(days = 14) {
  const s = await getSettings();
  const tz = s.business.timezone;
  const { start } = dayBounds(tz);
  const end = new Date(start.getTime() + days * 86_400_000);
  const [rows, blocks] = await Promise.all([
    db
      .select()
      .from(bookings)
      .where(
        and(
          inArray(bookings.status, ["PENDING", ...ENGAGED_STATUSES, "COMPLETED"]),
          lt(bookings.pickupAt, end),
          gte(bookings.estimatedEndAt, start),
        ),
      )
      .orderBy(asc(bookings.pickupAt)),
    db.select().from(blackouts).where(gte(blackouts.endsAt, new Date())).orderBy(asc(blackouts.startsAt)),
  ]);
  const daysOut = Array.from({ length: days }, (_, i) => {
    const dStart = new Date(start.getTime() + i * 86_400_000);
    const dEnd = new Date(dStart.getTime() + 86_400_000);
    return {
      date: wallDate(new Date(dStart.getTime() + 3_600_000), tz),
      bookings: rows.filter((b) => b.pickupAt < dEnd && b.estimatedEndAt >= dStart),
      blocked: blocks.filter((bl) => bl.startsAt < dEnd && bl.endsAt > dStart),
    };
  });
  return {
    tz,
    days: daysOut,
    blackouts: blocks.map((b) => ({ ...b, startsWall: utcToWallTime(b.startsAt, tz), endsWall: utcToWallTime(b.endsAt, tz) })),
  };
}

export async function listAudit(page: number) {
  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(50)
      .offset((page - 1) * 50),
    db.select({ n: count() }).from(auditLogs),
  ]);
  return { rows, total: Number(total?.n ?? 0) };
}

export async function listNotificationsAdmin() {
  return db
    .select({ n: notifications, code: bookings.code })
    .from(notifications)
    .leftJoin(bookings, eq(notifications.bookingId, bookings.id))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
}

export async function upcomingBetween(from: Date, to: Date) {
  return db
    .select()
    .from(bookings)
    .where(and(gte(bookings.pickupAt, from), lte(bookings.pickupAt, to), inArray(bookings.status, ENGAGED_STATUSES)))
    .orderBy(asc(bookings.pickupAt));
}
