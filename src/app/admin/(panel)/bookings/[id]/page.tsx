import type { Metadata } from "next";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CalendarIcon,
  ClockIcon,
  ExternalLinkIcon,
  MailIcon,
  MessageSquareTextIcon,
  NavigationIcon,
  PhoneIcon,
  RepeatIcon,
  RouteIcon,
  SnowflakeIcon,
  StarIcon,
  UsersIcon,
  WindIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNote, RetryNotification } from "@/components/admin/admin-note";
import { BookingActions } from "@/components/admin/booking-actions";
import { FareLines } from "@/components/booking/fare-summary";
import { WhatsAppIcon } from "@/components/shared/icons";
import { PaymentBadge, StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { getBookingAdmin } from "@/lib/server/admin-data";
import { requireAdminPage } from "@/lib/server/auth";
import { absoluteUrl } from "@/lib/server/env";
import { waLink } from "@/lib/server/notify/whatsapp";
import { qrPath } from "@/lib/server/qr";
import { formatDateTime, formatDuration, formatINR, formatPhone, formatRelative } from "@/lib/format";
import { TRIP_TYPE_LABEL } from "@/lib/types";
import { upiUri } from "@/lib/upi";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Booking" };

const dirLink = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

export default async function AdminBookingPage(props: PageProps<"/admin/bookings/[id]">) {
  await requireAdminPage();
  const { id } = await props.params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const data = await getBookingAdmin(id);
  if (!data) notFound();
  const { booking: b, customer: c, vehicle: v, settings: s } = data;
  const tz = s.tz;
  const first = b.contactName.split(" ")[0];
  const bookingUrl = absoluteUrl(`/account/bookings/${b.code}`);
  const due = b.status === "COMPLETED" && (b.paymentStatus === "UNPAID" || b.paymentStatus === "CLAIMED") && (b.finalFare ?? 0) > 0;
  const upi = due && s.upiId ? { vpa: s.upiId, name: s.payeeName } : null;
  const qr = upi ? qrPath(upiUri({ vpa: upi.vpa, name: upi.name, amountPaise: b.finalFare!, note: `${s.brand} ${b.code}` })) : null;
  const pkg = b.localPackage ? s.local.packages.find((p) => p.id === b.localPackage) : null;

  const templates = [
    { label: "Confirm ride", text: `Hi ${first}, this is your driver from ${s.brand}. Your ride ${b.code} on ${formatDateTime(b.pickupAt, tz)} is confirmed. Track it here: ${bookingUrl}` },
    { label: "On my way", text: `Hi ${first}, I'm on the way to your pickup point. See you soon! – ${s.brand}` },
    { label: "Arrived", text: `Hi ${first}, I've arrived at the pickup point. Please share your Ride PIN when you board.` },
    ...(due ? [{ label: "Payment link", text: `Hi ${first}, thank you for riding with ${s.brand}! Amount due: ${formatINR(b.finalFare!)}. Pay via UPI here: ${bookingUrl}` }] : []),
  ];

  return (
    <div className="space-y-5">
      <Link href="/admin/bookings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Bookings
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={b.status} />
            {b.status === "COMPLETED" && <PaymentBadge status={b.paymentStatus} />}
            <span className="text-xs text-muted-foreground">
              {TRIP_TYPE_LABEL[b.tripType]} · {b.source === "ADMIN" ? "Added by you" : "Online"} · {formatRelative(b.createdAt)}
            </span>
          </div>
          <h1 className="mt-2 font-mono text-[1.625rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">{b.code}</h1>
        </div>
        <p className="text-right">
          <span className="block text-xs text-muted-foreground">{b.finalFare !== null ? "Final fare" : b.quotedFare ? "Quoted" : "Estimate"}</span>
          <span className="text-2xl font-semibold tabular">{formatINR(b.finalFare ?? b.quotedFare ?? b.fareEstimate)}</span>
        </p>
      </header>

      {data.conflicts.length > 0 && (
        <div className="flex gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            <span className="font-semibold">Schedule conflict:</span> overlaps with{" "}
            {data.conflicts.map((x, i) => (
              <span key={x.id}>
                {i > 0 && ", "}
                <Link href={`/admin/bookings/${x.id}`} className="font-mono font-semibold underline">{x.code}</Link> ({formatDateTime(x.pickupAt, tz, "short")})
              </span>
            ))}
            . Consider declining or rescheduling.
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">Trip</h2>
            <div className="mt-4 space-y-4">
              <PlaceRow tone="pickup" label="Pickup" address={b.pickupAddress} lat={b.pickupLat} lng={b.pickupLng} />
              {b.dropAddress && b.dropLat !== null && b.dropLng !== null && (
                <PlaceRow tone="drop" label={b.tripType === "ROUND_TRIP" ? "Destination" : "Drop"} address={b.dropAddress} lat={b.dropLat} lng={b.dropLng} />
              )}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t pt-4 text-sm sm:grid-cols-3">
              <Info icon={CalendarIcon} label="Pickup" value={formatDateTime(b.pickupAt, tz)} />
              {b.returnAt && <Info icon={RepeatIcon} label="Return" value={formatDateTime(b.returnAt, tz)} />}
              {pkg && <Info icon={ClockIcon} label="Package" value={pkg.label} />}
              <Info icon={b.isAc ? SnowflakeIcon : WindIcon} label="Car" value={`${b.vehicleName} · ${b.isAc ? "AC" : "Non-AC"}`} />
              <Info icon={UsersIcon} label="Passengers" value={String(b.passengers)} />
              {b.distanceMeters && (
                <Info icon={RouteIcon} label="Route" value={`${Math.round(b.distanceMeters / 1000)} km · ~${formatDuration((b.durationSeconds ?? 0) / 60)}${b.routeSource === "estimate" ? " (approx.)" : ""}`} />
              )}
            </dl>
            {b.customerNote && (
              <p className="mt-4 flex gap-2 rounded-xl bg-muted/60 p-3 text-sm">
                <MessageSquareTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {b.customerNote}
              </p>
            )}
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{b.finalBreakdown ? "Final bill" : "Estimate"}</h2>
              {b.promoCode && <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Promo {b.promoCode}</span>}
            </div>
            <FareLines fare={b.finalBreakdown ?? b.fareBreakdown} className="mt-4" />
            <div className="mt-4 flex justify-between border-t pt-3 font-semibold">
              <span>Total</span>
              <span className="tabular">{formatINR((b.finalBreakdown ?? b.fareBreakdown).total)}</span>
            </div>
            {b.finalBreakdown && <p className="mt-2 text-xs text-muted-foreground">Original estimate: {formatINR(b.fareEstimate)}</p>}
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">Timeline</h2>
            <ol className="mt-4 space-y-3">
              {data.events.map((e, i) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${i === 0 ? "bg-primary ring-4 ring-primary/15" : "bg-border"}`} />
                  <div className="min-w-0">
                    <p>{e.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(e.createdAt, tz, "short")} · {e.actor.toLowerCase()}
                      {!e.visibleToCustomer && " · internal"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {data.notifications.length > 0 && (
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="font-semibold">Notifications</h2>
              <ul className="mt-3 divide-y text-sm">
                {data.notifications.map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="font-medium">{n.channel}</span> → {n.audience.toLowerCase()} · {n.event}
                      {n.lastError && <span className="block truncate text-xs text-destructive">{n.lastError}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${n.status === "SENT" ? "bg-success/12 text-success" : n.status === "FAILED" ? "bg-destructive/12 text-destructive" : "bg-muted text-muted-foreground"}`}>
                        {n.status}
                      </span>
                      {n.status === "FAILED" && <RetryNotification id={n.id} />}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border bg-card p-5 lg:sticky lg:top-20">
            <h2 className="mb-4 font-semibold">Actions</h2>
            <BookingActions
              id={b.id}
              code={b.code}
              status={b.status}
              paymentStatus={b.paymentStatus}
              tripType={b.tripType}
              finalFare={b.finalFare}
              finalInput={b.finalBreakdown?.input ?? null}
              estimateKm={b.fareBreakdown.billableKm}
              estimateDays={b.fareBreakdown.days}
              packageHours={pkg?.hours ?? null}
              requirePin={s.requireRidePin}
              paymentReference={b.paymentReference}
              paymentMethod={b.paymentMethod}
              qr={qr}
              upi={upi}
            />
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Customer</h2>
              <Link href={`/admin/customers/${c.id}`} className="text-xs font-medium text-primary">Profile</Link>
            </div>
            <p className="mt-3 font-medium">{b.contactName}</p>
            <p className="text-xs text-muted-foreground">
              {data.customerStats.tier} · {data.customerStats.rides} rides · {formatINR(data.customerStats.spent)} lifetime
              {c.status === "BLOCKED" && <span className="ml-1 font-semibold text-destructive">· BLOCKED</span>}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button asChild variant="outline">
                <a href={`tel:${b.contactPhone}`}>
                  <PhoneIcon /> Call
                </a>
              </Button>
              <Button asChild className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
                <a href={waLink(b.contactPhone)} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon className="size-4" /> Chat
                </a>
              </Button>
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <PhoneIcon className="size-3.5" /> {formatPhone(b.contactPhone)}
            </p>
            {b.contactEmail && (
              <p className="flex items-center gap-2 truncate text-sm text-muted-foreground">
                <MailIcon className="size-3.5" /> {b.contactEmail}
              </p>
            )}
            <div className="mt-4 border-t pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Quick WhatsApp messages</p>
              <div className="flex flex-wrap gap-1.5">
                {templates.map((t) => (
                  <Button key={t.label} asChild size="xs" variant="outline">
                    <a href={waLink(b.contactPhone, t.text)} target="_blank" rel="noopener noreferrer">
                      {t.label} <ExternalLinkIcon />
                    </a>
                  </Button>
                ))}
              </div>
            </div>
          </section>

          {data.review && (
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="font-semibold">Review</h2>
              <div className="mt-2 flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <StarIcon key={i} className={i <= data.review!.rating ? "size-4 fill-gold text-gold" : "size-4 text-muted-foreground/30"} />
                ))}
              </div>
              {data.review.comment && <p className="mt-2 text-sm text-muted-foreground">“{data.review.comment}”</p>}
            </section>
          )}

          <section className="rounded-2xl border bg-card p-5">
            <h2 className="mb-3 font-semibold">Private notes</h2>
            <AdminNote bookingId={b.id} initial={b.adminNote ?? ""} />
          </section>

          {v && (
            <section className="rounded-2xl border bg-card p-5 text-sm">
              <h2 className="font-semibold">Vehicle</h2>
              <p className="mt-2">{v.name}{v.model ? ` · ${v.model}` : ""}</p>
              {v.plateNumber && <p className="font-mono text-muted-foreground">{v.plateNumber}</p>}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function PlaceRow({ tone, label, address, lat, lng }: { tone: "pickup" | "drop"; label: string; address: string; lat: number; lng: number }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-1 size-3 shrink-0 rounded-full ring-4 ${tone === "pickup" ? "bg-success ring-success/40" : "bg-primary ring-primary/15"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{address}</p>
      </div>
      <Button asChild size="sm" variant="outline">
        <a href={dirLink(lat, lng)} target="_blank" rel="noopener noreferrer">
          <NavigationIcon /> Navigate
        </a>
      </Button>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof CalendarIcon; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
