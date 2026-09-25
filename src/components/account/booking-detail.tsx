"use client";

import { cn } from "cn";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheckIcon,
  BanIcon,
  CalendarIcon,
  CarFrontIcon,
  ClockIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  MessageSquareTextIcon,
  NavigationIcon,
  PhoneIcon,
  RepeatIcon,
  RouteIcon,
  SnowflakeIcon,
  StarIcon,
  UsersIcon,
  WindIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FareLines } from "@/components/booking/fare-summary";
import { WhatsAppIcon } from "@/components/shared/icons";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatDuration, formatINR, formatKm, initials, phoneDigits } from "@/lib/format";
import type { CustomerBookingDetail } from "@/lib/server/customer-bookings";
import { TERMINAL_STATUSES, TRIP_TYPE_LABEL } from "@/lib/types";
import { PaymentPanel } from "./payment-panel";
import { SuccessBadge } from "@/components/shared/success-badge";
import { StatusStepper } from "./status-stepper";

const mapsLink = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

export function BookingDetail({ data }: { data: CustomerBookingDetail }) {
  const router = useRouter();
  const params = useSearchParams();
  const { booking: b, driver, vehicle, events, timezone: tz } = data;
  const isNew = params.get("new") === "1";
  const lastUpdated = useRef(b.updatedAt);

  // Live updates: poll a tiny status endpoint; refresh the page when anything changes.
  useEffect(() => {
    lastUpdated.current = b.updatedAt;
    const live = !TERMINAL_STATUSES.includes(b.status) || b.paymentStatus === "CLAIMED" || (b.status === "COMPLETED" && b.paymentStatus === "UNPAID");
    if (!live) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const s = await api<{ updatedAt: string }>(`/api/account/bookings/${b.code}`);
          if (s.updatedAt !== lastUpdated.current) {
            lastUpdated.current = s.updatedAt;
            router.refresh();
          }
        } catch {
          /* transient */
        }
      }
      timer = setTimeout(tick, 8000);
    };
    timer = setTimeout(tick, 8000);
    return () => clearTimeout(timer);
  }, [b.code, b.status, b.paymentStatus, b.updatedAt, router]);

  const fare = b.finalBreakdown ?? b.fareBreakdown;
  const cancelled = b.status === "CANCELLED" || b.status === "REJECTED";

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {isNew && b.status === "PENDING" && (
          <motion.section
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-xl border bg-card px-6 py-10 text-center"
          >
            <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-accent to-transparent" />
            <div className="relative">
              <SuccessBadge />
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">Ride requested!</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Your booking <span className="font-mono font-semibold text-foreground">{b.code}</span> has reached the driver. This page updates live, and you’ll be notified the moment it’s confirmed.
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={b.status} />
            <span className="text-xs text-muted-foreground">{TRIP_TYPE_LABEL[b.tripType]}</span>
          </div>
          <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">{b.code}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Booked {formatDateTime(b.createdAt, tz, "short")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/book?trip=${b.tripType}`}>
              <RepeatIcon /> Book again
            </Link>
          </Button>
          {data.canCancel.ok && <CancelButton code={b.code} />}
        </div>
      </header>

      {!cancelled && (
        <section className="grid gap-6 rounded-xl border bg-card p-5 sm:p-6 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="mb-4 font-semibold">Ride status</h2>
            <StatusStepper status={b.status} paymentStatus={b.paymentStatus} events={events} tz={tz} />
          </div>
          <StatusMessage data={data} />
        </section>
      )}

      {cancelled && (
        <section className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/[0.05] p-5">
          <XCircleIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="text-sm">
            <p className="font-semibold">{b.status === "REJECTED" ? "The driver couldn’t take this ride" : "This booking was cancelled"}</p>
            {b.cancelReason && <p className="mt-1 text-muted-foreground">{b.cancelReason}</p>}
            <p className="mt-1 text-muted-foreground">No charges apply{b.fareBreakdown.discounts.some((d) => d.key === "credits") ? " and your credits were returned" : ""}.</p>
          </div>
        </section>
      )}

      {b.status === "COMPLETED" && <PaymentPanel data={data} />}
      {b.status === "COMPLETED" && !data.review && <ReviewForm code={b.code} />}
      {data.review && (
        <section className="rounded-xl border bg-card p-5">
          <p className="text-sm font-semibold">Your rating</p>
          <div className="mt-2 flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <StarIcon key={i} className={i <= data.review!.rating ? "size-5 fill-gold text-gold" : "size-5 text-muted-foreground/30"} />
            ))}
          </div>
          {data.review.comment && <p className="mt-2 text-sm text-muted-foreground">“{data.review.comment}”</p>}
          {data.review.adminReply && <p className="mt-2 rounded-xl bg-muted p-3 text-sm">Driver: {data.review.adminReply}</p>}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="font-semibold">Trip details</h2>
          <div className="relative space-y-5 pl-7">
            <span aria-hidden className="absolute bottom-3 left-[9px] top-3 w-px border-l-2 border-dashed border-border" />
            <Place tone="pickup" label="Pickup" address={b.pickupAddress} lat={b.pickupLat} lng={b.pickupLng} />
            {b.dropAddress && b.dropLat !== null && b.dropLng !== null && (
              <Place tone="drop" label={b.tripType === "ROUND_TRIP" ? "Destination" : "Drop"} address={b.dropAddress} lat={b.dropLat} lng={b.dropLng} />
            )}
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t pt-5 text-sm">
            <Info icon={CalendarIcon} label="Pickup time" value={formatDateTime(b.pickupAt, tz)} />
            {b.returnAt && <Info icon={RepeatIcon} label="Return" value={formatDateTime(b.returnAt, tz)} />}
            {b.packageLabel && <Info icon={ClockIcon} label="Package" value={b.packageLabel} />}
            <Info icon={b.isAc ? SnowflakeIcon : WindIcon} label="Car" value={`${b.vehicleName} · ${b.isAc ? "AC" : "Non-AC"}`} />
            <Info icon={UsersIcon} label="Passengers" value={String(b.passengers)} />
            {b.distanceKm !== null && <Info icon={RouteIcon} label="Distance" value={`${formatKm(b.distanceKm)}${b.durationMin ? ` · ~${formatDuration(b.durationMin)}` : ""}`} />}
          </dl>
          {b.customerNote && (
            <p className="flex gap-2 rounded-xl bg-muted/60 p-3 text-sm">
              <MessageSquareTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {b.customerNote}
            </p>
          )}
        </section>

        <div className="space-y-6">
          {driver && (
            <section className="rounded-xl border bg-card p-5 sm:p-6">
              <h2 className="font-semibold">Your driver</h2>
              <div className="mt-4 flex items-center gap-4">
                {driver.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={driver.photoUrl} alt={driver.name} className="size-14 rounded-2xl object-cover" />
                ) : (
                  <span className="grid size-14 place-items-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">{initials(driver.name)}</span>
                )}
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-semibold">
                    {driver.name} {driver.verified && <BadgeCheckIcon className="size-4 fill-info text-white" />}
                  </p>
                  <p className="text-xs text-muted-foreground">{driver.experienceYears}+ yrs · {driver.languages.join(", ")}</p>
                  {vehicle && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs">
                      <CarFrontIcon className="size-3.5 text-primary" />
                      {[vehicle.color, vehicle.model ?? vehicle.name].filter(Boolean).join(" ")}
                      {vehicle.plateNumber && <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold">{vehicle.plateNumber}</span>}
                    </p>
                  )}
                </div>
              </div>
              {!TERMINAL_STATUSES.includes(b.status) && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {driver.phone && (
                    <Button asChild variant="outline">
                      <a href={`tel:${driver.phone}`}>
                        <PhoneIcon /> Call
                      </a>
                    </Button>
                  )}
                  {driver.whatsapp && (
                    <Button asChild className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
                      <a href={`https://wa.me/${phoneDigits(driver.whatsapp)}?text=${encodeURIComponent(`Hi, regarding my booking ${b.code}`)}`} target="_blank" rel="noopener noreferrer">
                        <WhatsAppIcon className="size-4" /> WhatsApp
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </section>
          )}

          <section className="rounded-xl border bg-card p-5 sm:p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{b.finalBreakdown ? "Final fare" : "Estimated fare"}</h2>
              <span className="text-xl font-semibold tabular">{formatINR(b.finalFare ?? b.quotedFare ?? b.fareEstimate)}</span>
            </div>
            {b.quotedFare && !b.finalFare && <p className="mt-1 text-xs text-muted-foreground">Fixed quote from the driver (estimate was {formatINR(b.fareEstimate)}).</p>}
            <FareLines fare={fare} className="mt-4" />
            {!b.finalBreakdown && <p className="mt-4 text-xs text-muted-foreground">Final fare is confirmed at the end of the trip based on actual distance, tolls and parking.</p>}
          </section>
        </div>
      </div>

      {events.length > 0 && (
        <section className="rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="font-semibold">Activity</h2>
          <ol className="mt-4 space-y-4">
            {[...events].reverse().map((e, i) => (
              <li key={e.id} className="flex gap-3">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", i === 0 ? "bg-primary ring-4 ring-primary/15" : "bg-border")} />
                <div className="text-sm">
                  <p className={cn(i === 0 && "font-medium")}>{e.message}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(e.createdAt, tz, "short")}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function StatusMessage({ data }: { data: CustomerBookingDetail }) {
  const b = data.booking;
  const pin = b.ridePin;
  const content: Record<string, { title: string; body: string }> = {
    PENDING: { title: "Waiting for confirmation", body: "Your request has reached the driver. You’ll get an email/WhatsApp as soon as it’s accepted." },
    CONFIRMED: { title: "You’re all set!", body: "Your ride is confirmed. Keep your Ride PIN handy — share it with the driver only when you board." },
    EN_ROUTE: { title: "Driver is on the way", body: "Please be ready at your pickup point a few minutes early." },
    ARRIVED: { title: "Driver has arrived", body: "Your driver is waiting. Share your Ride PIN to start the trip." },
    IN_PROGRESS: { title: "Enjoy your ride", body: "Sit back and relax. The final fare will appear here when you arrive." },
    COMPLETED: { title: "Trip completed", body: "Thank you for riding with us!" },
  };
  const c = content[b.status];
  if (!c) return null;
  return (
    <div className="flex flex-col justify-between gap-5 rounded-xl bg-secondary/70 p-5 lg:self-start">
      <div className="flex gap-3">
        {b.status === "PENDING" ? (
          <span className="relative mt-0.5 grid size-9 shrink-0 place-items-center">
            <span className="absolute inset-0 rounded-full bg-primary/25 animate-ping-slow" />
            <span className="relative size-3 rounded-full bg-primary" />
          </span>
        ) : (
          <NavigationIcon className="mt-1 size-5 shrink-0 text-primary" />
        )}
        <div>
          <p className="font-semibold">{c.title}</p>
          <p className="text-sm text-muted-foreground">{c.body}</p>
        </div>
      </div>
      {pin && (
        <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-card px-5 py-4 text-center">
          <p className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <KeyRoundIcon className="size-3" /> Ride PIN
          </p>
          <p className="mt-1 font-mono text-4xl font-bold tracking-[0.4em] text-primary">{pin}</p>
          <p className="mt-1 text-xs text-muted-foreground">Share only when you board</p>
        </div>
      )}
    </div>
  );
}

function Place({ tone, label, address, lat, lng }: { tone: "pickup" | "drop"; label: string; address: string; lat: number; lng: number }) {
  return (
    <div className="relative">
      <span className={cn("absolute -left-7 top-1 grid size-[18px] place-items-center rounded-full ring-4 ring-card", tone === "pickup" ? "bg-success" : "bg-primary")}>
        <span className="size-1.5 rounded-full bg-white" />
      </span>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{address}</p>
      <a href={mapsLink(lat, lng)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
        Open in Maps <ExternalLinkIcon className="size-3" />
      </a>
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

function CancelButton({ code }: { code: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <BanIcon /> Cancel ride
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>There’s no charge for cancelling now. The driver will be notified immediately.</AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Reason (optional) — helps us improve" rows={3} />
        <AlertDialogFooter>
          <AlertDialogCancel>Keep booking</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api(`/api/account/bookings/${code}/cancel`, { body: { reason: reason.trim() || undefined } });
                toast.success("Booking cancelled");
                router.refresh();
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner />} Cancel booking
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ReviewForm({ code }: { code: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const labels = ["", "Poor", "Fair", "Good", "Great", "Excellent!"];
  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6">
      <h2 className="font-semibold">How was your ride?</h2>
      <p className="text-sm text-muted-foreground">Your feedback helps us keep every ride five-star.</p>
      <div className="mt-4 flex items-center gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={rating === i}
            aria-label={`${i} star${i > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(i)}
            onClick={() => setRating(i)}
            className="rounded-md p-0.5 transition-transform hover:scale-110"
          >
            <StarIcon className={cn("size-8", i <= (hover || rating) ? "fill-gold text-gold" : "text-muted-foreground/30")} />
          </button>
        ))}
        <span className="ml-2 text-sm font-medium text-muted-foreground">{labels[hover || rating]}</span>
      </div>
      {rating > 0 && (
        <div className="mt-4 space-y-3">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={600} rows={3} placeholder="Tell us more (optional)" />
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/api/account/bookings/${code}/review`, { body: { rating, comment: comment.trim() || undefined } });
                toast.success("Thank you for your feedback!");
                router.refresh();
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner />} Submit review
          </Button>
        </div>
      )}
    </section>
  );
}
