import { and, desc, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { route } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { getSetting } from "@/lib/server/settings";
import { utcToWallTime, wallTimeToUtc } from "@/lib/time";

/** Neutralise spreadsheet formula injection (CSV injection). */
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export const GET = route(
  {
    auth: "admin",
    query: z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() }),
    rateLimit: [{ name: "adminexport", limit: 20, windowSec: 3600, by: "admin" }],
  },
  async ({ admin, query, ip, userAgent }) => {
    const tz = (await getSetting("business")).timezone;
    const conds = [];
    if (query.from) conds.push(gte(bookings.pickupAt, wallTimeToUtc(`${query.from}T00:00`, tz)));
    if (query.to) conds.push(lte(bookings.pickupAt, wallTimeToUtc(`${query.to}T23:59`, tz)));
    const rows = await db
      .select()
      .from(bookings)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(bookings.pickupAt))
      .limit(20000);
    const header = [
      "Booking ID", "Status", "Trip type", "Pickup time", "Customer", "Phone", "Email", "Pickup", "Drop",
      "Vehicle", "AC", "Passengers", "Distance (km)", "Estimate (INR)", "Final fare (INR)", "Payment status",
      "Payment method", "Reference", "Paid at", "Created at",
    ];
    const lines = rows.map((b) =>
      [
        b.code, b.status, b.tripType, utcToWallTime(b.pickupAt, tz).replace("T", " "), b.contactName, b.contactPhone,
        b.contactEmail, b.pickupAddress, b.dropAddress ?? "", b.vehicleName, b.isAc ? "Yes" : "No", b.passengers,
        b.distanceMeters ? (b.distanceMeters / 1000).toFixed(1) : "", (b.fareEstimate / 100).toFixed(2),
        b.finalFare !== null ? (b.finalFare / 100).toFixed(2) : "", b.paymentStatus, b.paymentMethod ?? "",
        b.paymentReference ?? "", b.paidAt ? utcToWallTime(b.paidAt, tz).replace("T", " ") : "",
        utcToWallTime(b.createdAt, tz).replace("T", " "),
      ]
        .map(cell)
        .join(","),
    );
    await audit({ actorType: "ADMIN", actorId: admin!.id, action: "bookings.export", meta: { rows: rows.length, ...query }, ip, userAgent });
    return new Response(`﻿${[header.map(cell).join(","), ...lines].join("\r\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  },
);
