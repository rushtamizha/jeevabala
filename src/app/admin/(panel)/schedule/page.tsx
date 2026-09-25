import type { Metadata } from "next";
import { cn } from "cn";
import { CalendarOffIcon } from "lucide-react";
import Link from "next/link";
import { BlackoutManager } from "@/components/admin/blackout-manager";
import { StatusBadge } from "@/components/shared/status-badge";
import { getSchedule } from "@/lib/server/admin-data";
import { requireAdminPage } from "@/lib/server/auth";
import { formatDateTime, formatINR } from "@/lib/format";
import { TRIP_TYPE_LABEL } from "@/lib/types";
import { wallDate } from "@/lib/time";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage() {
  await requireAdminPage();
  const s = await getSchedule(14);
  const today = wallDate(new Date(), s.tz);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">Schedule</h1>
        <p className="text-sm text-muted-foreground">Next 14 days. As a single driver, overlapping requests are flagged automatically.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {s.days.map((d) => {
            const label = new Date(`${d.date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
            const isToday = d.date === today;
            if (d.bookings.length === 0 && d.blocked.length === 0 && !isToday) return null;
            return (
              <section key={d.date} className={cn("rounded-2xl border bg-card", isToday && "border-primary/40")}>
                <h2 className="flex items-center justify-between border-b px-5 py-3 text-sm font-semibold">
                  <span>{isToday ? `Today · ${label}` : label}</span>
                  <span className="text-xs font-normal text-muted-foreground">{d.bookings.length} ride{d.bookings.length === 1 ? "" : "s"}</span>
                </h2>
                {d.blocked.map((bl) => (
                  <p key={bl.id} className="flex items-center gap-2 border-b bg-secondary/60 px-5 py-2.5 text-sm text-muted-foreground">
                    <CalendarOffIcon className="size-4" /> Unavailable {formatDateTime(bl.startsAt, s.tz, "short")} – {formatDateTime(bl.endsAt, s.tz, "short")}
                    {bl.reason ? ` · ${bl.reason}` : ""}
                  </p>
                ))}
                {d.bookings.length === 0 && d.blocked.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted-foreground">Free day.</p>}
                <ul className="divide-y">
                  {d.bookings.map((b) => (
                    <li key={b.id}>
                      <Link href={`/admin/bookings/${b.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40">
                        <div className="w-20 shrink-0">
                          <p className="text-sm font-semibold tabular">{formatDateTime(b.pickupAt, s.tz, "time")}</p>
                          <p className="text-[11px] text-muted-foreground">until ~{formatDateTime(b.estimatedEndAt, s.tz, "time")}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{b.contactName} · {TRIP_TYPE_LABEL[b.tripType]}</p>
                          <p className="truncate text-xs text-muted-foreground">{b.pickupAddress.split(",")[0]}{b.dropAddress ? ` → ${b.dropAddress.split(",")[0]}` : ""} · {formatINR(b.finalFare ?? b.quotedFare ?? b.fareEstimate)}</p>
                        </div>
                        <StatusBadge status={b.status} short />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        <section className="h-fit rounded-2xl border bg-card p-5 xl:sticky xl:top-20">
          <h2 className="font-semibold">Time off</h2>
          <p className="mb-4 text-sm text-muted-foreground">Block dates when you’re unavailable — the booking form won’t allow them.</p>
          <BlackoutManager items={s.blackouts.map((b) => ({ id: b.id, startsWall: b.startsWall, endsWall: b.endsWall, reason: b.reason }))} />
        </section>
      </div>
    </div>
  );
}
