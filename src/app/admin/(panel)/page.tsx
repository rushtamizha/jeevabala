import type { Metadata } from "next";
import {
  ArrowRightIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  CircleIcon,
  IndianRupeeIcon,
  InboxIcon,
  StarIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { KpiCard } from "@/components/admin/kpi-card";
import { DashPanel, PageTitle } from "@/components/admin/ui";
import { AcceptRejectButtons } from "@/components/admin/quick-actions";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { PaymentBadge, StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { getDashboard } from "@/lib/server/admin-data";
import { requireAdminPage } from "@/lib/server/auth";
import { firstName, formatDateTime, formatINR, formatRelative } from "@/lib/format";
import { TRIP_TYPE_LABEL } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const { admin } = await requireAdminPage();
  const d = await getDashboard();
  const tz = d.tz;
  const doneCount = d.checklist.filter((c) => c.done).length;
  const totalTrips = d.tripSplit.reduce((s, t) => s + t.rides, 0);

  return (
    <div className="space-y-6">
      <PageTitle
        title={<>Hello, {firstName(admin.name)}</>}
        description={<>{formatDateTime(new Date(), tz, "day")} · here’s your business at a glance.</>}
        actions={
          <>
            <Button asChild variant="outline" className="bg-card">
              <Link href="/admin/schedule">
                <CalendarClockIcon /> Today’s schedule
              </Link>
            </Button>
            <Button asChild className="shadow-glow">
              <Link href="/admin/bookings?tab=pending">
                <InboxIcon /> Ride requests{d.kpis.pending > 0 ? ` · ${d.kpis.pending}` : ""}
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard index={0} icon={InboxIcon} label="Pending requests" value={d.kpis.pending} sub="Awaiting your response" href="/admin/bookings?tab=pending" tone={d.kpis.pending > 0 ? "primary" : "default"} />
        <KpiCard index={1} icon={CalendarClockIcon} label="Rides today" value={d.kpis.todayRides} sub="Confirmed & completed" href="/admin/schedule" />
        <KpiCard
          index={2}
          icon={IndianRupeeIcon}
          label="Revenue this month"
          value={formatINR(d.kpis.monthRevenue)}
          sub={
            d.kpis.revenueDelta !== null ? (
              <span className={d.kpis.revenueDelta >= 0 ? "inline-flex items-center gap-1 font-semibold text-success" : "inline-flex items-center gap-1 font-semibold text-destructive"}>
                {d.kpis.revenueDelta >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
                {Math.abs(d.kpis.revenueDelta)}% <span className="font-normal text-muted-foreground">vs last month</span>
              </span>
            ) : (
              `${d.kpis.monthRides} completed rides`
            )
          }
        />
        <KpiCard
          index={3}
          icon={WalletIcon}
          label="Outstanding"
          value={formatINR(d.kpis.outstanding)}
          sub={`${d.kpis.outstandingCount} unpaid trip${d.kpis.outstandingCount === 1 ? "" : "s"}`}
          href="/admin/payments"
          tone={d.kpis.outstanding > 0 ? "warning" : "default"}
        />
      </div>

      {doneCount < d.checklist.length && (
        <section className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold">Finish setting up</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{doneCount} of {d.checklist.length} complete — each step makes you more bookable.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold tabular">{Math.round((doneCount / d.checklist.length) * 100)}%</span>
              <div className="h-2 w-40 overflow-hidden rounded-full bg-secondary">
                <div className="h-full origin-left rounded-full bg-primary animate-grow-x" style={{ width: `${(doneCount / d.checklist.length) * 100}%` }} />
              </div>
            </div>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {d.checklist.map((c) => (
              <li key={c.key}>
                <Link href={c.href} className="group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors hover:border-primary/30 hover:bg-accent/50">
                  {c.done ? <CheckCircle2Icon className="size-4 shrink-0 text-success" /> : <CircleIcon className="size-4 shrink-0 text-muted-foreground" />}
                  <span className={c.done ? "text-muted-foreground line-through" : "font-medium"}>{c.label}</span>
                  {!c.done && <ArrowRightIcon className="ml-auto size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-6">
        <DashPanel title="Ride requests" description="New bookings appear here instantly" action={{ href: "/admin/bookings?tab=pending", label: "View all" }}>
          {d.pendingList.length === 0 ? (
            <Empty icon={InboxIcon} text="No pending requests right now." />
          ) : (
            <ul className="divide-y">
              {d.pendingList.map((b) => (
                <li key={b.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center">
                  <Link href={`/admin/bookings/${b.id}`} className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-bold">
                      <span className="font-mono">{b.code}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{TRIP_TYPE_LABEL[b.tripType]}</span>
                      <span className="text-xs font-normal text-muted-foreground">{formatRelative(b.createdAt)}</span>
                    </p>
                    <p className="mt-1 truncate text-sm">
                      {b.pickupAddress.split(",")[0]}
                      {b.dropAddress && <span className="text-muted-foreground"> → {b.dropAddress.split(",")[0]}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(b.pickupAt, tz, "short")} · {b.contactName} · <span className="font-semibold text-foreground">{formatINR(b.fareEstimate)}</span>
                    </p>
                  </Link>
                  <AcceptRejectButtons bookingId={b.id} compact />
                </li>
              ))}
            </ul>
          )}
        </DashPanel>

        <DashPanel title="Upcoming" description="Confirmed rides, soonest first" action={{ href: "/admin/schedule", label: "Schedule" }}>
          {d.upcoming.length === 0 ? (
            <Empty icon={CalendarClockIcon} text="No confirmed rides coming up." />
          ) : (
            <ul className="divide-y">
              {d.upcoming.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/bookings/${b.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-secondary/50">
                    <div className="w-14 shrink-0 rounded-xl bg-secondary py-1.5 text-center">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{formatDateTime(b.pickupAt, tz, "day").split(",")[0]}</p>
                      <p className="text-sm font-bold tabular">{formatDateTime(b.pickupAt, tz, "time")}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{b.contactName}</p>
                      <p className="truncate text-xs text-muted-foreground">{b.pickupAddress.split(",")[0]}{b.dropAddress ? ` → ${b.dropAddress.split(",")[0]}` : ""}</p>
                    </div>
                    <StatusBadge status={b.status} short />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-6">
        <DashPanel
          title="Revenue · last 30 days"
          description="Completed trips by completion date"
          action={<p className="text-lg font-bold tabular">{formatINR(d.series.reduce((s, x) => s + x.revenue * 100, 0))}</p>}
          bodyClassName="p-5"
        >
          <RevenueChart data={d.series} />
        </DashPanel>
        <div className="space-y-4 lg:space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <KpiCard index={4} icon={StarIcon} label="Rating" value={d.kpis.avgRating ? `${d.kpis.avgRating}★` : "—"} sub={`${d.kpis.reviewCount} reviews`} href="/admin/reviews" />
            <KpiCard index={5} icon={UsersIcon} label="Customers" value={d.kpis.customers} sub={`+${d.kpis.newCustomers} this month`} href="/admin/customers" />
          </div>
          <DashPanel title="Trip mix" description={`Lifetime: ${d.kpis.lifetimeRides} paid trips · ${formatINR(d.kpis.lifetimeRevenue)}`} bodyClassName="p-5">
            {totalTrips === 0 ? (
              <p className="text-sm text-muted-foreground">Complete your first trips to see the split.</p>
            ) : (
              <ul className="space-y-3.5">
                {d.tripSplit.map((t, i) => (
                  <li key={t.tripType}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{TRIP_TYPE_LABEL[t.tripType]}</span>
                      <span className="tabular text-muted-foreground">
                        {t.rides} · <span className="font-semibold text-foreground">{formatINR(t.revenue)}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full origin-left rounded-full bg-primary animate-grow-x" style={{ width: `${(t.rides / totalTrips) * 100}%`, animationDelay: `${i * 80}ms` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DashPanel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        {d.claims.length > 0 && (
          <DashPanel title="Payments to verify" description="Customers reported these as paid — check your UPI app." className="border-primary/35">
            <ul className="divide-y">
              {d.claims.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/bookings/${b.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-secondary/50">
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold">{b.contactName} · <span className="font-mono">{b.code}</span></p>
                      <p className="text-xs text-muted-foreground">Ref: {b.paymentReference || "not provided"} · {b.paymentMethod}</p>
                    </div>
                    <span className="flex items-center gap-2">
                      <span className="font-bold tabular">{formatINR(b.finalFare ?? 0)}</span>
                      <PaymentBadge status={b.paymentStatus} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </DashPanel>
        )}
        <DashPanel title="Recent activity" description="Every change to every booking">
          {d.activity.length === 0 ? (
            <Empty icon={InboxIcon} text="Nothing yet." />
          ) : (
            <ul className="divide-y">
              {d.activity.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/bookings/${a.bookingId}`} className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-secondary/50">
                    <span className="size-2 shrink-0 rounded-full bg-primary/70" />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-mono text-xs text-muted-foreground">{a.code}</span> {a.message}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(a.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashPanel>
      </div>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof InboxIcon; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-secondary text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
