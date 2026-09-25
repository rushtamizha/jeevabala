import type { Metadata } from "next";
import { cn } from "cn";
import { DownloadIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { AcceptRejectButtons } from "@/components/admin/quick-actions";
import { PaymentBadge, StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BOOKING_TABS, listBookings, type BookingTab } from "@/lib/server/admin-data";
import { requireAdminPage } from "@/lib/server/auth";
import { getSetting } from "@/lib/server/settings";
import { formatDateTime, formatINR, formatPhone } from "@/lib/format";
import { TRIP_TYPE_LABEL } from "@/lib/types";

export const metadata: Metadata = { title: "Bookings" };

const TAB_LABEL: Record<BookingTab, string> = {
  pending: "Requests",
  upcoming: "Upcoming",
  live: "On trip",
  completed: "Completed",
  cancelled: "Cancelled",
  all: "All",
};

export default async function AdminBookings(props: PageProps<"/admin/bookings">) {
  await requireAdminPage();
  const sp = await props.searchParams;
  const tab = (typeof sp.tab === "string" && sp.tab in BOOKING_TABS ? sp.tab : "pending") as BookingTab;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));
  const [{ rows, total, pageSize, tabCounts }, business] = await Promise.all([listBookings({ tab, q: q || undefined, page }), getSetting("business")]);
  const tz = business.timezone;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const qs = (o: Record<string, string | number>) => {
    const p = new URLSearchParams({ tab, ...(q ? { q } : {}), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) });
    return `/admin/bookings?${p}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">Bookings</h1>
          <p className="text-sm text-muted-foreground">{total} {TAB_LABEL[tab].toLowerCase()}</p>
        </div>
        <Button asChild variant="outline">
          {/* File download from an API route, not a page navigation. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/admin/export" download>
            <DownloadIcon /> Export CSV
          </a>
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav className="relative flex gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1 scrollbar-none" aria-label="Booking status">
          {(Object.keys(BOOKING_TABS) as BookingTab[]).map((t) => (
            <Link
              key={t}
              href={`/admin/bookings?tab=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {TAB_LABEL[t]}
              <span className={cn("rounded-full px-1.5 text-[11px] tabular", tab === t ? "bg-primary text-primary-foreground" : "bg-background")}>{tabCounts[t]}</span>
            </Link>
          ))}
        </nav>
        <form className="relative w-full lg:w-80" action="/admin/bookings">
          <input type="hidden" name="tab" value={tab} />
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search code, name, phone, place…" className="h-10 rounded-xl pl-9" maxLength={80} />
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">No bookings found.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <ul className="divide-y">
            {rows.map((b) => (
              <li key={b.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 lg:flex-row lg:items-center lg:gap-6">
                <Link href={`/admin/bookings/${b.id}`} className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[140px_1fr_150px] sm:items-center">
                  <div>
                    <p className="font-mono text-sm font-semibold">{b.code}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <StatusBadge status={b.status} short />
                      {b.status === "COMPLETED" && <PaymentBadge status={b.paymentStatus} />}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {b.pickupAddress.split(",")[0]}
                      {b.dropAddress && <span className="text-muted-foreground"> → {b.dropAddress.split(",")[0]}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {TRIP_TYPE_LABEL[b.tripType]} · {b.isAc ? "AC" : "Non-AC"} · {b.contactName} · {formatPhone(b.contactPhone)}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-sm font-medium tabular">{formatDateTime(b.pickupAt, tz, "short")}</p>
                    <p className="text-xs text-muted-foreground tabular">{formatINR(b.finalFare ?? b.quotedFare ?? b.fareEstimate)}</p>
                  </div>
                </Link>
                {b.status === "PENDING" && (
                  <div className="shrink-0">
                    <AcceptRejectButtons bookingId={b.id} compact />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className={cn(page <= 1 && "pointer-events-none opacity-50")}>
              <Link href={qs({ page: page - 1 })}>Previous</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className={cn(page >= pages && "pointer-events-none opacity-50")}>
              <Link href={qs({ page: page + 1 })}>Next</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
