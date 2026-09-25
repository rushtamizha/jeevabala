import type { Metadata } from "next";
import { CarFrontIcon } from "lucide-react";
import { BookingCard } from "@/components/account/booking-card";
import { EmptyState } from "@/components/shared/empty-state";
import { UnderlineTabs } from "@/components/shared/underline-tabs";
import { listCustomerBookings } from "@/lib/server/account";
import { requireCustomerPage } from "@/lib/server/auth";
import { getSetting } from "@/lib/server/settings";
import { ACTIVE_STATUSES } from "@/lib/types";

export const metadata: Metadata = { title: "My rides" };

export default async function MyRides() {
  const { customer } = await requireCustomerPage("/account/bookings");
  const [rows, business] = await Promise.all([listCustomerBookings(customer.id, 100), getSetting("business")]);
  const tz = business.timezone;
  const upcoming = rows.filter((r) => ACTIVE_STATUSES.includes(r.status)).reverse();
  const completed = rows.filter((r) => r.status === "COMPLETED");
  const cancelled = rows.filter((r) => r.status === "CANCELLED" || r.status === "REJECTED");
  const list = (items: typeof rows, empty: { title: string; body: string }) =>
    items.length ? (
      <div className="grid gap-4 xl:grid-cols-2">{items.map((b) => <BookingCard key={b.code} b={b} tz={tz} />)}</div>
    ) : (
      <EmptyState icon={CarFrontIcon} title={empty.title} body={empty.body} cta={{ href: "/book", label: "Book a ride" }} />
    );
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.03em]">My rides</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track live trips, pay, and download receipts.</p>
      </div>
      <UnderlineTabs
        initial={upcoming.length ? "upcoming" : completed.length ? "completed" : "upcoming"}
        tabs={[
          { id: "upcoming", label: "Upcoming", count: upcoming.length, content: list(upcoming, { title: "No upcoming rides", body: "Plan your next trip in under a minute." }) },
          { id: "completed", label: "Completed", count: completed.length, content: list(completed, { title: "No completed rides yet", body: "Your trip history and receipts will appear here." }) },
          { id: "cancelled", label: "Cancelled", count: cancelled.length, content: list(cancelled, { title: "Nothing cancelled", body: "Great — every ride went ahead as planned." }) },
        ]}
      />
    </div>
  );
}
