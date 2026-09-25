import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FareLines } from "@/components/booking/fare-summary";
import { Logo } from "@/components/brand/logo";
import { PrintButton } from "@/components/shared/print-button";
import { ApiError } from "@/lib/server/api";
import { requireCustomerPage } from "@/lib/server/auth";
import { customerBookingDetail } from "@/lib/server/customer-bookings";
import { getSetting } from "@/lib/server/settings";
import { formatDateTime, formatINR, formatKm, formatPhone } from "@/lib/format";
import { TRIP_TYPE_LABEL } from "@/lib/types";

export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPage(props: PageProps<"/account/bookings/[code]/receipt">) {
  const { code } = await props.params;
  const { customer } = await requireCustomerPage(`/account/bookings/${encodeURIComponent(code)}/receipt`);
  let data;
  try {
    data = await customerBookingDetail(customer.id, code);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const b = data.booking;
  if (b.status !== "COMPLETED" || !b.finalBreakdown) notFound();
  const business = await getSetting("business");
  const tz = data.timezone;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>
      <article className="rounded-xl border bg-card p-8 print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-4 border-b pb-6">
          <div>
            <Logo name={business.name} />
            <p className="mt-3 max-w-xs text-xs text-muted-foreground">{business.address || `${business.city}, ${business.region}`}</p>
            {business.phone && <p className="text-xs text-muted-foreground">{business.phone}</p>}
            {business.gstin && <p className="text-xs text-muted-foreground">GSTIN: {business.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Receipt</p>
            <p className="mt-1 font-mono text-lg font-semibold">{b.code}</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(b.completedAt ?? b.pickupAt, tz, "date")}</p>
            <p className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${b.paymentStatus === "PAID" ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}>
              {b.paymentStatus === "PAID" ? "PAID" : b.paymentStatus === "WAIVED" ? "WAIVED" : "PAYMENT DUE"}
            </p>
          </div>
        </header>
        <section className="grid gap-4 border-b py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Billed to</p>
            <p className="mt-1 font-medium">{b.contactName}</p>
            <p className="text-muted-foreground">{formatPhone(b.contactPhone)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Trip</p>
            <p className="mt-1 font-medium">
              {TRIP_TYPE_LABEL[b.tripType]} · {b.vehicleName} ({b.isAc ? "AC" : "Non-AC"})
            </p>
            <p className="text-muted-foreground">{formatDateTime(b.pickupAt, tz)}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Route</p>
            <p className="mt-1">{b.pickupAddress}</p>
            {b.dropAddress && <p className="text-muted-foreground">→ {b.dropAddress}</p>}
            {b.finalBreakdown.billableKm > 0 && <p className="mt-1 text-xs text-muted-foreground">Billed distance: {formatKm(b.finalBreakdown.billableKm)}</p>}
          </div>
        </section>
        <section className="py-6">
          <FareLines fare={b.finalBreakdown} />
          <div className="mt-4 flex justify-between border-t pt-4 text-lg font-semibold">
            <span>Total</span>
            <span className="tabular">{formatINR(b.finalBreakdown.total)}</span>
          </div>
          {b.paidAt && (
            <p className="mt-2 text-right text-xs text-muted-foreground">
              Paid via {b.paymentMethod} on {formatDateTime(b.paidAt, tz, "short")}
              {b.paymentReference ? ` · Ref ${b.paymentReference}` : ""}
            </p>
          )}
        </section>
        <footer className="border-t pt-5 text-center text-xs text-muted-foreground">Thank you for riding with {business.name}. This is a computer-generated receipt.</footer>
      </article>
    </div>
  );
}
