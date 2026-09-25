import { CalendarIcon, PlaneIcon, RepeatIcon, RouteIcon, TimerIcon } from "lucide-react";
import Link from "next/link";
import { PaymentBadge, StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import type { BookingListItem } from "@/lib/server/account";
import { formatDateTime, formatINR } from "@/lib/format";
import { TRIP_TYPE_LABEL, type TripType } from "@/lib/types";

const TRIP_ICON: Record<TripType, typeof RouteIcon> = { ONE_WAY: RouteIcon, ROUND_TRIP: RepeatIcon, AIRPORT: PlaneIcon, LOCAL: TimerIcon };

/** Booking card: trip tile + status, a route line from pickup to drop, date and fare, then pill actions. */
export function BookingCard({ b, tz }: { b: BookingListItem; tz: string }) {
  const Icon = TRIP_ICON[b.tripType];
  const cancelled = b.status === "CANCELLED" || b.status === "REJECTED";
  const done = b.status === "COMPLETED";
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border bg-card transition-[border-color,box-shadow] duration-300 hover:border-primary/25 hover:shadow-premium">
      <Link href={`/account/bookings/${b.code}`} className="block flex-1 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {TRIP_TYPE_LABEL[b.tripType]} · <span className="font-mono normal-case tracking-normal">#{b.code}</span>
              </p>
              <p className="truncate text-sm font-semibold">
                {b.isAc ? "AC" : "Non-AC"} {b.vehicleName.split(" (")[0]}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusBadge status={b.status} short />
            {done && <PaymentBadge status={b.paymentStatus} />}
          </div>
        </div>

        <div className="mt-4 flex items-stretch gap-3">
          <span aria-hidden className="flex w-3 flex-col items-center py-1">
            <span className="size-2.5 shrink-0 rounded-full border-[2.5px] border-success bg-card" />
            {b.dropAddress && (
              <>
                <span className="my-1 w-px flex-1 border-l-2 border-dotted border-border" />
                <span className="size-2.5 shrink-0 rounded-full bg-primary" />
              </>
            )}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="truncate text-sm font-semibold" title={b.pickupAddress}>{b.pickupAddress}</p>
            {b.dropAddress && <p className="truncate text-sm font-semibold" title={b.dropAddress}>{b.dropAddress}</p>}
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3 rounded-xl bg-secondary px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><CalendarIcon className="size-3" /> Pickup</p>
            <p className="truncate text-[13px] font-semibold">{formatDateTime(b.pickupAt, tz, "short")}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">{done ? "Fare" : "Estimate"}</p>
            <p className="text-base font-bold tabular">{formatINR(b.amount)}</p>
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-2 border-t px-4 py-3 sm:px-5">
        {cancelled || done ? (
          <>
            <Button asChild variant="secondary">
              <Link href={`/book?trip=${b.tripType}`}>Re-book</Link>
            </Button>
            <Button asChild>
              <Link href={`/account/bookings/${b.code}`}>{done && b.paymentStatus === "UNPAID" ? "Pay now" : done ? "Receipt & review" : "Details"}</Link>
            </Button>
          </>
        ) : (
          <Button asChild className="col-span-2">
            <Link href={`/account/bookings/${b.code}`}>Track ride</Link>
          </Button>
        )}
      </div>
    </article>
  );
}
