import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { bookings, customers, notifications, vehicles, type Booking } from "@/db/schema";
import { formatDateTime, formatDuration, formatINR, formatPhone } from "@/lib/format";
import { STATUS_LABEL, TRIP_TYPE_LABEL } from "@/lib/types";
import { absoluteUrl, env } from "../env";
import { getIntegrations, getSettings, type Integrations } from "../settings";
import { renderEmail, sendEmail, type EmailBlock } from "./email";
import { sendTelegramMessage, tgEscape, type TgButton } from "./telegram";
import { sendWhatsApp } from "./whatsapp";

export type NotifyEvent =
  | "booking.created"
  | "booking.confirmed"
  | "booking.rejected"
  | "booking.cancelled"
  | "driver.en_route"
  | "driver.arrived"
  | "trip.started"
  | "trip.completed"
  | "payment.claimed"
  | "payment.received"
  | "review.created";

type Extra = { cancelledBy?: "CUSTOMER" | "ADMIN" | "SYSTEM" | "TELEGRAM"; reason?: string; rating?: number; comment?: string; conflicts?: string[] };

type Draft = {
  channel: "TELEGRAM" | "WHATSAPP" | "EMAIL";
  audience: "ADMIN" | "CUSTOMER";
  recipient: string;
  payload: Record<string, unknown>;
};

const ADMIN_EVENTS: NotifyEvent[] = ["booking.created", "booking.cancelled", "payment.claimed", "review.created"];

function publicHttpsUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !["localhost", "127.0.0.1"].includes(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Queue notifications for a booking event across every configured channel, then
 * deliver them after the HTTP response has been sent (never blocks the user).
 */
export async function notifyBooking(event: NotifyEvent, bookingId: string, extra: Extra = {}) {
  try {
    const drafts = await buildDrafts(event, bookingId, extra);
    if (drafts.length === 0) return;
    const rows = await db
      .insert(notifications)
      .values(drafts.map((d) => ({ ...d, event, bookingId })))
      .returning({ id: notifications.id });
    const ids = rows.map((r) => r.id);
    try {
      after(() => deliverMany(ids));
    } catch {
      // Outside a request scope (e.g. scripts) – deliver inline.
      void deliverMany(ids);
    }
  } catch (err) {
    console.error(`[notify] failed to queue ${event} for ${bookingId}:`, err);
  }
}

async function buildDrafts(event: NotifyEvent, bookingId: string, extra: Extra): Promise<Draft[]> {
  const [row] = await db
    .select({ booking: bookings, customer: customers, vehicle: vehicles })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .leftJoin(vehicles, eq(bookings.vehicleId, vehicles.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!row) return [];
  const { booking: b, customer: c, vehicle: v } = row;
  const s = await getSettings();
  const integ = await getIntegrations();
  const brand = s.business.name;
  const tz = s.business.timezone;
  const when = formatDateTime(b.pickupAt, tz);
  const customerUrl = absoluteUrl(`/account/bookings/${b.code}`);
  const adminUrl = absoluteUrl(`/admin/bookings/${b.id}`);
  const fare = formatINR(b.finalFare ?? b.quotedFare ?? b.fareEstimate);
  const route = b.dropAddress ? `${b.pickupAddress} → ${b.dropAddress}` : b.pickupAddress;
  const vehicleLabel = `${b.vehicleName}${b.isAc ? " · AC" : " · Non-AC"}`;
  const drafts: Draft[] = [];
  const prefs = s.notifications;

  /* ------------------------------ Admin -------------------------------- */
  if (ADMIN_EVENTS.includes(event)) {
    const { title, lines } = adminCopy(event, b, extra, { when, fare, vehicleLabel });
    const buttons: TgButton[][] = [];
    if (integ.telegram.webhookEnabled) {
      if (event === "booking.created" && b.status === "PENDING") {
        buttons.push([
          { text: "✅ Accept", callback_data: `acc:${b.id}` },
          { text: "❌ Decline", callback_data: `rej:${b.id}` },
        ]);
      }
      if (event === "payment.claimed") buttons.push([{ text: "✅ Mark as paid", callback_data: `paid:${b.id}` }]);
    }
    if (publicHttpsUrl(adminUrl)) buttons.push([{ text: "Open in dashboard ↗", url: adminUrl }]);

    if (prefs.admin.telegram && integ.telegram.configured) {
      const html = [`<b>${tgEscape(title)}</b> · <code>${tgEscape(b.code)}</code>`, "", ...lines.map((l) => l.html)].join("\n");
      drafts.push({
        channel: "TELEGRAM",
        audience: "ADMIN",
        recipient: integ.telegram.chatId!,
        payload: { text: html, buttons },
      });
    }
    if (prefs.admin.whatsapp && integ.whatsapp.configured && integ.whatsapp.adminNumber) {
      const text = [`*${title}* · ${b.code}`, "", ...lines.map((l) => l.text), "", adminUrl].join("\n");
      drafts.push({ channel: "WHATSAPP", audience: "ADMIN", recipient: integ.whatsapp.adminNumber, payload: { text } });
    }
    const adminEmail = prefs.adminEmail || env().ADMIN_NOTIFY_EMAIL;
    if (prefs.admin.email && integ.smtp.configured && adminEmail) {
      const mail = renderEmail({
        brand,
        preheader: `${title} · ${b.code}`,
        title: `${title} · ${b.code}`,
        blocks: [
          { type: "kv", rows: lines.map((l) => [l.label, l.text.replace(/^[^:]+:\s*/, "")] as [string, string]) },
          { type: "button", label: "Open in dashboard", href: adminUrl },
        ],
        footer: `Operational alert from ${brand}.`,
      });
      drafts.push({
        channel: "EMAIL",
        audience: "ADMIN",
        recipient: adminEmail,
        payload: { subject: `${title} · ${b.code}`, ...mail },
      });
    }
  }

  /* ----------------------------- Customer ------------------------------ */
  const copy = customerCopy(event, b, extra, {
    brand,
    when,
    fare,
    route,
    vehicleLabel,
    driverName: s.business.driver.name,
    driverPhone: s.business.phone,
    vehicle: v,
    upiReady: Boolean(s.payment.upiEnabled && s.payment.upiId),
  });
  if (copy && !c.deletedAt) {
    if (prefs.customer.email && integ.smtp.configured) {
      const mail = renderEmail({
        brand,
        preheader: copy.preheader,
        title: copy.title,
        blocks: [...copy.blocks, { type: "button", label: copy.cta ?? "View booking", href: customerUrl }],
      });
      drafts.push({
        channel: "EMAIL",
        audience: "CUSTOMER",
        recipient: b.contactEmail,
        payload: { subject: `${copy.title} · ${b.code}`, ...mail },
      });
    }
    if (
      prefs.customer.whatsapp &&
      integ.whatsapp.configured &&
      integ.whatsapp.canMessageCustomers &&
      c.whatsappOptIn
    ) {
      drafts.push({
        channel: "WHATSAPP",
        audience: "CUSTOMER",
        recipient: b.contactPhone,
        payload: { text: `*${brand}* — ${copy.whatsapp}\n\n${customerUrl}` },
      });
    }
  }
  return drafts;
}

type Line = { label: string; text: string; html: string };

function line(icon: string, label: string, value: string): Line {
  return { label, text: `${label}: ${value}`, html: `${icon} <b>${tgEscape(label)}:</b> ${tgEscape(value)}` };
}

function adminCopy(
  event: NotifyEvent,
  b: Booking,
  extra: Extra,
  f: { when: string; fare: string; vehicleLabel: string },
): { title: string; lines: Line[] } {
  const base = [
    line("🧭", "Trip", `${TRIP_TYPE_LABEL[b.tripType]} · ${f.vehicleLabel} · ${b.passengers} pax`),
    line("📍", "Pickup", b.pickupAddress),
    ...(b.dropAddress ? [line("🏁", "Drop", b.dropAddress)] : []),
    line("🗓", "When", f.when),
    line("👤", "Customer", `${b.contactName} · ${formatPhone(b.contactPhone)}`),
  ];
  switch (event) {
    case "booking.created": {
      const lines = [
        ...base,
        ...(b.distanceMeters
          ? [line("🛣", "Distance", `${Math.round(b.distanceMeters / 1000)} km · ~${formatDuration((b.durationSeconds ?? 0) / 60)}`)]
          : []),
        line("💰", "Estimate", f.fare),
      ];
      if (b.customerNote) lines.push(line("📝", "Note", b.customerNote));
      if (extra.conflicts?.length) lines.push(line("⚠️", "Schedule conflict", extra.conflicts.join(", ")));
      return { title: "🚖 New ride request", lines };
    }
    case "booking.cancelled":
      return {
        title: "🚫 Booking cancelled by customer",
        lines: [...base, ...(extra.reason ? [line("💬", "Reason", extra.reason)] : [])],
      };
    case "payment.claimed":
      return {
        title: "💸 Customer reports payment",
        lines: [
          line("👤", "Customer", b.contactName),
          line("💰", "Amount", formatINR(b.finalFare ?? b.fareEstimate)),
          line("🔢", "Reference", b.paymentReference || "Not provided"),
          line("💳", "Method", b.paymentMethod ?? "UPI"),
        ],
      };
    case "review.created":
      return {
        title: `⭐ New ${extra.rating ?? ""}-star review`,
        lines: [line("👤", "Customer", b.contactName), ...(extra.comment ? [line("💬", "Comment", extra.comment)] : [])],
      };
    default:
      return { title: STATUS_LABEL[b.status], lines: base };
  }
}

type CustomerCopy = {
  title: string;
  preheader: string;
  blocks: EmailBlock[];
  whatsapp: string;
  cta?: string;
};

function customerCopy(
  event: NotifyEvent,
  b: Booking,
  extra: Extra,
  f: {
    brand: string;
    when: string;
    fare: string;
    route: string;
    vehicleLabel: string;
    driverName: string;
    driverPhone: string;
    vehicle: typeof vehicles.$inferSelect | null;
    upiReady: boolean;
  },
): CustomerCopy | null {
  const first = b.contactName.split(" ")[0];
  const tripRows: [string, string][] = [
    ["Booking ID", b.code],
    ["Trip", TRIP_TYPE_LABEL[b.tripType]],
    ["Pickup", b.pickupAddress],
    ...(b.dropAddress ? ([["Drop", b.dropAddress]] as [string, string][]) : []),
    ["Date & time", f.when],
    ["Vehicle", f.vehicleLabel],
  ];
  const vehicleDesc = f.vehicle
    ? [f.vehicle.color, f.vehicle.model ?? f.vehicle.name, f.vehicle.plateNumber].filter(Boolean).join(" · ")
    : b.vehicleName;

  switch (event) {
    case "booking.created":
      return {
        title: "We’ve received your ride request",
        preheader: `Booking ${b.code} for ${f.when} — awaiting confirmation.`,
        blocks: [
          { type: "p", text: `Hi ${first}, thank you for choosing ${f.brand}. Your driver will confirm the ride shortly — we’ll notify you the moment it’s accepted.` },
          { type: "kv", rows: [...tripRows, ["Estimated fare", f.fare]] },
        ],
        whatsapp: `Hi ${first}, we've received your ride request ${b.code} for ${f.when}. We'll confirm shortly.`,
        cta: "Track your booking",
      };
    case "booking.confirmed":
      return {
        title: "Your ride is confirmed",
        preheader: `${f.driverName} will pick you up on ${f.when}. Ride PIN ${b.ridePin}.`,
        blocks: [
          { type: "p", text: `Great news, ${first}! ${f.driverName} has accepted your ride and will be at your pickup point on time.` },
          { type: "kv", rows: [...tripRows, ["Driver", `${f.driverName}${f.driverPhone ? ` · ${formatPhone(f.driverPhone)}` : ""}`], ["Car", vehicleDesc], ["Fare", f.fare]] },
          { type: "p", text: "Your Ride PIN — share it with the driver only when you board:" },
          { type: "code", text: b.ridePin },
        ],
        whatsapp: `Your ride ${b.code} is confirmed for ${f.when}. Driver: ${f.driverName}. Ride PIN: ${b.ridePin} (share only when you board).`,
      };
    case "booking.rejected":
      return {
        title: "We couldn’t take this ride",
        preheader: `Booking ${b.code} could not be accepted.`,
        blocks: [
          { type: "p", text: `Sorry ${first}, we’re unable to accept booking ${b.code} for ${f.when}.${b.cancelReason ? ` Reason: ${b.cancelReason}.` : ""}` },
          { type: "p", text: "Any reward credits used have been returned to your account. Please try another time slot — we’d love to drive you." },
        ],
        whatsapp: `Sorry ${first}, we couldn't accept ride ${b.code} for ${f.when}.${b.cancelReason ? ` Reason: ${b.cancelReason}.` : ""} Please try another slot.`,
        cta: "Book another time",
      };
    case "booking.cancelled":
      if (extra.cancelledBy === "CUSTOMER") {
        return {
          title: "Your booking was cancelled",
          preheader: `Booking ${b.code} has been cancelled.`,
          blocks: [{ type: "p", text: `Hi ${first}, as requested, booking ${b.code} for ${f.when} has been cancelled. No charges apply.` }],
          whatsapp: `Your booking ${b.code} for ${f.when} has been cancelled as requested.`,
        };
      }
      return {
        title: "Your booking was cancelled",
        preheader: `Booking ${b.code} has been cancelled by ${f.brand}.`,
        blocks: [
          { type: "p", text: `Hi ${first}, we’re sorry — booking ${b.code} for ${f.when} had to be cancelled.${extra.reason ? ` Reason: ${extra.reason}.` : ""}` },
          { type: "p", text: "Any reward credits used have been returned to your account." },
        ],
        whatsapp: `We're sorry — ride ${b.code} for ${f.when} had to be cancelled.${extra.reason ? ` Reason: ${extra.reason}.` : ""}`,
      };
    case "driver.en_route":
      return {
        title: "Your driver is on the way",
        preheader: `${f.driverName} is heading to your pickup point.`,
        blocks: [
          { type: "p", text: `${f.driverName} is on the way to ${b.pickupAddress}.` },
          { type: "kv", rows: [["Car", vehicleDesc], ["Ride PIN", b.ridePin]] },
        ],
        whatsapp: `${f.driverName} is on the way to your pickup point (${vehicleDesc}). Ride PIN: ${b.ridePin}.`,
      };
    case "driver.arrived":
      return {
        title: "Your driver has arrived",
        preheader: `${f.driverName} is waiting at your pickup point.`,
        blocks: [
          { type: "p", text: `${f.driverName} has arrived at your pickup point. Share your Ride PIN when you board.` },
          { type: "code", text: b.ridePin },
        ],
        whatsapp: `${f.driverName} has arrived at your pickup point. Ride PIN: ${b.ridePin}.`,
      };
    case "trip.started":
      return null; // Customer is in the car – no need to notify.
    case "trip.completed":
      return {
        title: "Thanks for riding with us",
        preheader: `Trip ${b.code} completed. Amount due: ${f.fare}.`,
        blocks: [
          { type: "p", text: `Hope you had a comfortable ride, ${first}! Here’s your trip summary.` },
          { type: "kv", rows: [["Booking ID", b.code], ["Trip", f.route], ["Amount due", f.fare]] },
          ...(f.upiReady
            ? ([{ type: "p", text: "Pay securely with any UPI app — open your booking to scan the QR or tap “Pay with UPI”." }] as EmailBlock[])
            : []),
        ],
        whatsapp: `Trip ${b.code} completed. Amount due: ${f.fare}. Pay via UPI from your booking page:`,
        cta: f.upiReady ? "Pay now" : "View trip",
      };
    case "payment.received":
      return {
        title: "Payment received — thank you!",
        preheader: `We received ${f.fare} for ${b.code}.`,
        blocks: [
          { type: "p", text: `Hi ${first}, we’ve received your payment of ${f.fare} for booking ${b.code}. Your receipt is available in your dashboard.` },
          { type: "p", text: "Loved the ride? A quick rating helps us serve you better." },
        ],
        whatsapp: `Payment of ${f.fare} received for ${b.code}. Thank you for riding with us! 🙏`,
        cta: "View receipt & rate",
      };
    default:
      return null;
  }
}

/* ----------------------------------------------------------------------------
 * Delivery
 * ------------------------------------------------------------------------- */

const MAX_ATTEMPTS = 4;

async function deliverMany(ids: string[]) {
  if (ids.length === 0) return;
  const integ = await getIntegrations();
  const s = await getSettings();
  const rows = await db.select().from(notifications).where(inArray(notifications.id, ids));
  await Promise.all(rows.map((n) => deliverOne(n, integ, s.business.name)));
}

async function deliverOne(n: typeof notifications.$inferSelect, integ: Integrations, brand: string) {
  if (n.status === "SENT") return;
  try {
    const p = n.payload as Record<string, unknown>;
    if (n.channel === "TELEGRAM") {
      if (!integ.telegram.configured) throw new SkipError("Telegram not configured");
      await sendTelegramMessage(integ.telegram.botToken!, n.recipient, String(p.text), p.buttons as TgButton[][]);
    } else if (n.channel === "WHATSAPP") {
      if (!integ.whatsapp.configured) throw new SkipError("WhatsApp not configured");
      await sendWhatsApp(integ.whatsapp, n.recipient, String(p.text));
    } else {
      if (!integ.smtp.configured) throw new SkipError("SMTP not configured");
      await sendEmail(
        integ.smtp,
        { to: n.recipient, subject: String(p.subject), html: String(p.html), text: String(p.text) },
        brand,
      );
    }
    await db
      .update(notifications)
      .set({ status: "SENT", sentAt: new Date(), attempts: n.attempts + 1, lastError: null })
      .where(eq(notifications.id, n.id));
  } catch (err) {
    const skip = err instanceof SkipError;
    const message = (err as Error).message?.slice(0, 500) ?? "unknown error";
    console.warn(`[notify] ${n.channel} → ${n.audience} failed: ${message}`);
    await db
      .update(notifications)
      .set({ status: skip ? "SKIPPED" : "FAILED", attempts: n.attempts + 1, lastError: message })
      .where(eq(notifications.id, n.id));
  }
}

class SkipError extends Error {}

/** Retry failed deliveries (called by the cron endpoint or the admin "retry" button). */
export async function retryFailedNotifications(limit = 25) {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.status, "FAILED"),
        lt(notifications.attempts, MAX_ATTEMPTS),
        sql`${notifications.createdAt} > now() - interval '2 days'`,
      ),
    )
    .limit(limit);
  await deliverMany(rows.map((r) => r.id));
  return rows.length;
}

export async function retryNotification(id: string) {
  await db.update(notifications).set({ status: "PENDING" }).where(eq(notifications.id, id));
  await deliverMany([id]);
}
