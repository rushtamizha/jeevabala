"use client";

import { cn } from "cn";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpDownIcon,
  CheckIcon,
  LockIcon,
  MinusIcon,
  PhoneIcon,
  PlusIcon,
  ShieldCheckIcon,
  SnowflakeIcon,
  TagIcon,
  UsersIcon,
  WalletIcon,
  WindIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { WhatsAppIcon } from "@/components/shared/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError, api, errorMessage } from "@/lib/api-client";
import { formatINR, phoneDigits } from "@/lib/format";
import { TRIP_TYPE_LABEL, type SignedPlace, type TripType } from "@/lib/types";
import { DateTimeField, type WallValue } from "./date-time-field";
import { FareSummary } from "./fare-summary";
import { LocationInput } from "./location-input";
import type { VerifiedCustomer } from "./otp-dialog";
import { VehiclePicker } from "./vehicle-picker";
import type { BookingConfig, BookingPrefill, EstimateResponse } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Email verification (input-otp + Turnstile) is only needed at the very last step — load it on demand.
const loadOtp = () => import("./otp-dialog").then((m) => m.OtpDialog);
const OtpDialog = dynamic(loadOtp, { ssr: false });

export function BookingWidget({
  config,
  prefill,
  variant = "hero",
}: {
  config: BookingConfig;
  prefill?: BookingPrefill;
  variant?: "hero" | "page";
}) {
  const router = useRouter();
  const startedAt = useRef(Date.now());
  const [tripType, setTripType] = useState<TripType>(
    prefill?.tripType && config.tripTypes.includes(prefill.tripType) ? prefill.tripType : config.tripTypes[0],
  );
  const [pickup, setPickup] = useState<SignedPlace | null>(prefill?.pickup ?? null);
  const [drop, setDrop] = useState<SignedPlace | null>(prefill?.drop ?? null);
  const [when, setWhen] = useState<WallValue>(null);
  const [returnWhen, setReturnWhen] = useState<WallValue>(null);
  const [pkg, setPkg] = useState(config.localPackages[0]?.id ?? "");
  const [vehicleId, setVehicleId] = useState(
    config.vehicles.find((v) => prefill?.vehicleId && (v.id === prefill.vehicleId || v.slug === prefill.vehicleId))?.id ?? config.vehicles[0]?.id,
  );
  const vehicle = config.vehicles.find((v) => v.id === vehicleId) ?? config.vehicles[0];
  const acPossible = config.acMode !== "non-ac-only" && (vehicle?.hasAc ?? true);
  const nonAcPossible = config.acMode !== "ac-only";
  const [isAc, setIsAc] = useState(prefill?.isAc ?? acPossible);
  const [passengers, setPassengers] = useState(Math.min(prefill?.passengers ?? 1, vehicle?.seats ?? 4));

  const [step, setStep] = useState<"trip" | "review">("trip");
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [customer, setCustomer] = useState(config.customer);
  const [name, setName] = useState(config.customer?.name ?? "");
  const [phone, setPhone] = useState(config.customer?.phone?.replace(/^\+91/, "") ?? "");
  const [email, setEmail] = useState(config.customer?.email ?? "");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [promo, setPromo] = useState(prefill?.promo ?? "");
  const [showPromo, setShowPromo] = useState(Boolean(prefill?.promo));
  const [useCredits, setUseCredits] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [otpOpen, setOtpOpen] = useState(false);
  const [referral, setReferral] = useState<string | undefined>(prefill?.ref);

  useEffect(() => {
    try {
      if (prefill?.ref) localStorage.setItem("sa_ref", prefill.ref);
      else setReferral(localStorage.getItem("sa_ref") ?? undefined);
    } catch {
      /* storage unavailable */
    }
  }, [prefill?.ref]);

  useEffect(() => {
    if (!acPossible && isAc) setIsAc(false);
    if (!nonAcPossible && !isAc) setIsAc(true);
    if (vehicle && passengers > vehicle.seats) setPassengers(vehicle.seats);
  }, [acPossible, nonAcPossible, isAc, vehicle, passengers]);

  const needsDrop = tripType !== "LOCAL";
  const creditsTouched = useRef(false);

  const request = useMemo(
    () => ({
      tripType,
      pickup: pickup!,
      drop: needsDrop ? drop : null,
      pickupAt: when?.date && when.time ? `${when.date}T${when.time}` : "",
      returnAt: tripType === "ROUND_TRIP" && returnWhen?.time ? `${returnWhen.date}T${returnWhen.time}` : null,
      localPackageId: tripType === "LOCAL" ? pkg : null,
      vehicleId: vehicle?.id ?? null,
      isAc,
      passengers,
      promoCode: showPromo && promo.trim() ? promo.trim().toUpperCase() : undefined,
      useCredits: useCredits || undefined,
    }),
    [tripType, pickup, drop, needsDrop, when, returnWhen, pkg, vehicle, isAc, passengers, promo, showPromo, useCredits],
  );

  function validateTrip() {
    const e: Record<string, string> = {};
    if (!pickup) e.pickup = "Choose a pickup location";
    if (needsDrop && !drop) e.drop = "Choose a drop location";
    if (!when?.date || !when.time) e.pickupAt = "Choose date & time";
    if (tripType === "ROUND_TRIP" && (!returnWhen?.date || !returnWhen.time)) e.returnAt = "Choose return date & time";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function fetchEstimate(): Promise<EstimateResponse | null> {
    setFormError(null);
    try {
      const data = await api<EstimateResponse>("/api/estimate", { body: request });
      setEstimate(data);
      return data;
    } catch (err) {
      if (err instanceof ApiClientError) {
        const f = err.fields;
        const mapped: Record<string, string> = {};
        for (const k of Object.keys(f)) mapped[k.split(".")[0]] = f[k];
        setErrors((prev) => ({ ...prev, ...mapped }));
      }
      setFormError(errorMessage(err));
      return null;
    }
  }

  async function onCheckFare() {
    if (!validateTrip()) return;
    setLoading(true);
    const data = await fetchEstimate();
    setLoading(false);
    if (data) setStep("review");
  }

  async function onApplyPromo() {
    setLoading(true);
    const data = await fetchEstimate();
    setLoading(false);
    if (data?.promo) (data.promo.applied ? toast.success : toast.error)(data.promo.message);
  }

  useEffect(() => {
    if (step === "review" && !customer) void loadOtp();
  }, [step, customer]);

  useEffect(() => {
    if (!creditsTouched.current) {
      creditsTouched.current = true;
      return;
    }
    if (step === "review") void onApplyPromo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useCredits]);

  function validateContact() {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Enter your full name";
    const digits = phone.replace(/\D/g, "");
    if (!(digits.length === 10 || (digits.length === 12 && digits.startsWith("91")))) e.phone = "Enter a valid 10-digit mobile number";
    if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email address";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function book() {
    setBooking(true);
    setFormError(null);
    try {
      const res = await api<{ code: string }>("/api/bookings", {
        body: {
          ...request,
          contact: { name: name.trim(), phone: phone.trim(), email: email.trim().toLowerCase() },
          note: note.trim() || undefined,
          website: honeypot || undefined,
          startedAt: startedAt.current,
        },
      });
      toast.success("Ride requested! The driver will confirm shortly.");
      router.push(`/account/bookings/${res.code}?new=1`);
      router.refresh();
    } catch (err) {
      setBooking(false);
      if (err instanceof ApiClientError && err.status === 401) {
        setCustomer(null);
        setOtpOpen(true);
        return;
      }
      if (err instanceof ApiClientError && err.fields.promoCode) setErrors((p) => ({ ...p, promoCode: err.fields.promoCode }));
      setFormError(errorMessage(err));
    }
  }

  async function onConfirm() {
    if (!validateContact()) return;
    if (!estimate?.availability.ok) {
      setFormError("Please choose another time — the driver is unavailable for this slot.");
      return;
    }
    if (!customer) {
      setOtpOpen(true);
      return;
    }
    await book();
  }

  async function onVerified(c: VerifiedCustomer) {
    setOtpOpen(false);
    setCustomer({ ...c, tier: null });
    if (!c.name || c.name === email.split("@")[0]) {
      /* keep typed name */
    }
    setBooking(true);
    const before = estimate?.fare.total;
    const fresh = await fetchEstimate();
    if (fresh && before !== undefined && fresh.fare.total !== before) {
      setBooking(false);
      toast.info("Your member benefits were applied — please review the updated fare.");
      return;
    }
    await book();
  }

  if (!config.accepting) {
    return (
      <WidgetShell variant={variant}>
        <div className="space-y-4 p-6 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-secondary text-primary">
            <PhoneIcon className="size-5" />
          </div>
          <p className="text-balance text-sm text-muted-foreground">{config.pausedMessage}</p>
          <ContactButtons phone={config.contactPhone} whatsapp={config.whatsapp} />
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell variant={variant}>
      {step === "trip" ? (
          <div key="trip" className="p-4 animate-in fade-in-0 slide-in-from-left-2 duration-300 sm:p-5">
            {variant === "hero" && (
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold leading-tight tracking-tight">Book your ride</h2>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">Instant fare · pay after the trip</p>
                </div>
                <span className="inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-success/10 px-2.5 text-[11px] font-semibold text-success">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full rounded-full bg-success opacity-70 animate-ping-slow" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-success" />
                  </span>
                  Available 24×7
                </span>
              </div>
            )}
            <TripTabs types={config.tripTypes} value={tripType} onChange={(t) => { setTripType(t); setErrors({}); }} />

            <div className="mt-3.5 space-y-2.5">
              <div className="relative space-y-2">
                <LocationInput
                  label={tripType === "AIRPORT" ? "Pickup (home or airport)" : "Pickup"}
                  placeholder="Where should we pick you up?"
                  value={pickup}
                  onChange={(p) => { setPickup(p); setErrors((e) => ({ ...e, pickup: "" })); }}
                  tone="pickup"
                  allowLocate
                  savedPlaces={config.savedPlaces}
                  invalid={Boolean(errors.pickup)}
                />
                {needsDrop && (
                  <>
                    <LocationInput
                      label={tripType === "AIRPORT" ? "Drop (airport or home)" : tripType === "ROUND_TRIP" ? "Destination" : "Drop"}
                      placeholder={tripType === "AIRPORT" ? "e.g. Chennai International Airport" : "Where are you going?"}
                      value={drop}
                      onChange={(p) => { setDrop(p); setErrors((e) => ({ ...e, drop: "" })); }}
                      tone="drop"
                      savedPlaces={config.savedPlaces}
                      invalid={Boolean(errors.drop)}
                    />
                    <button
                      type="button"
                      aria-label="Swap pickup and drop"
                      onClick={() => { setPickup(drop); setDrop(pickup); }}
                      className="absolute right-4 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border-4 border-card bg-foreground text-white shadow-md transition-transform duration-500 hover:rotate-180 active:scale-90"
                    >
                      <ArrowUpDownIcon className="size-3.5" />
                    </button>
                  </>
                )}
              </div>

              {tripType === "LOCAL" && (
                <div className="grid grid-cols-3 gap-2">
                  {config.localPackages.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPkg(p.id)}
                      aria-pressed={pkg === p.id}
                      className={cn(
                        "rounded-xl border px-2 py-2.5 text-center transition-colors",
                        pkg === p.id ? "border-primary bg-accent [&_span:first-child]:text-primary" : "border-transparent bg-secondary hover:border-border",
                      )}
                    >
                      <span className="block text-sm font-semibold">{p.hours} hrs</span>
                      <span className="block text-[11px] text-muted-foreground">{p.km} km · {formatINR(Math.round(((isAc ? p.acPrice : p.nonAcPrice) * (vehicle?.localPct ?? 100)) / 100))}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className={cn("grid gap-2.5", tripType === "ROUND_TRIP" && "sm:grid-cols-2")}>
                <DateTimeField
                  label="Pickup"
                  value={when}
                  onChange={(v) => { setWhen(v); setErrors((e) => ({ ...e, pickupAt: "" })); }}
                  timezone={config.timezone}
                  leadMinutes={config.minLeadMinutes}
                  maxAdvanceDays={config.maxAdvanceDays}
                  invalid={Boolean(errors.pickupAt)}
                />
                {tripType === "ROUND_TRIP" && (
                  <DateTimeField
                    label="Return"
                    value={returnWhen}
                    onChange={(v) => { setReturnWhen(v); setErrors((e) => ({ ...e, returnAt: "" })); }}
                    timezone={config.timezone}
                    leadMinutes={config.minLeadMinutes}
                    maxAdvanceDays={config.maxAdvanceDays}
                    minValue={when?.time ? when : undefined}
                    invalid={Boolean(errors.returnAt)}
                  />
                )}
              </div>

              {config.vehicles.length > 1 && (
                <VehiclePicker vehicles={config.vehicles} value={vehicleId} onChange={setVehicleId} tripType={tripType} isAc={isAc} pkgId={pkg} />
              )}

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div className="flex h-12 rounded-full bg-secondary p-1 dark:bg-white/[0.05]" role="radiogroup" aria-label="Air conditioning">
                  <AcOption active={isAc} disabled={!acPossible} onClick={() => setIsAc(true)} icon={SnowflakeIcon} label="AC" />
                  <AcOption active={!isAc} disabled={!nonAcPossible} onClick={() => setIsAc(false)} icon={WindIcon} label="Non-AC" />
                </div>
                <div className="flex h-12 items-center gap-1.5" aria-label="Passengers">
                  <button type="button" aria-label="Fewer passengers" disabled={passengers <= 1} onClick={() => setPassengers((p) => p - 1)} className="grid size-10 place-items-center rounded-full bg-secondary text-foreground transition hover:bg-accent hover:text-primary active:scale-90 disabled:opacity-40">
                    <MinusIcon className="size-4" />
                  </button>
                  <span className="flex h-12 w-12 flex-col items-center justify-center leading-none" aria-live="polite">
                    <span className="text-base font-bold tabular">{passengers}</span>
                    <span className="mt-0.5 flex items-center gap-0.5 text-[10px] text-muted-foreground"><UsersIcon className="size-2.5" /> pax</span>
                  </span>
                  <button type="button" aria-label="More passengers" disabled={passengers >= (vehicle?.seats ?? 4)} onClick={() => setPassengers((p) => p + 1)} className="grid size-10 place-items-center rounded-full bg-secondary text-foreground transition hover:bg-accent hover:text-primary active:scale-90 disabled:opacity-40">
                    <PlusIcon className="size-4" />
                  </button>
                </div>
              </div>

              {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}
              {Object.values(errors).some(Boolean) && !formError && (
                <p className="text-sm text-destructive" role="alert">{Object.values(errors).find(Boolean)}</p>
              )}

              <Button size="xl" className="sheen w-full shadow-glow" onClick={onCheckFare} disabled={loading}>
                {loading ? <Spinner /> : null}
                {loading ? "Calculating your fare…" : "Check fare & book"}
                {!loading && <ArrowRightIcon />}
              </Button>
              <p className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><CheckIcon className="size-3 text-success" /> No payment now</span>
                <span className="inline-flex items-center gap-1"><CheckIcon className="size-3 text-success" /> No surge</span>
                <span className="inline-flex items-center gap-1"><CheckIcon className="size-3 text-success" /> Free cancellation</span>
              </p>
            </div>
          </div>
        ) : (
          <div key="review" className="space-y-4 p-4 animate-in fade-in-0 slide-in-from-right-2 duration-300 sm:p-5">
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Edit trip" onClick={() => setStep("trip")} className="grid size-9 shrink-0 place-items-center rounded-full border bg-card shadow-arc transition-transform active:scale-95">
                <ArrowLeftIcon className="size-4" />
              </button>
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium">
                  {pickup?.label.split(",")[0]}
                  {needsDrop && drop ? <> <span className="text-muted-foreground">→</span> {drop.label.split(",")[0]}</> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {TRIP_TYPE_LABEL[tripType]} · {isAc ? "AC" : "Non-AC"} {vehicle?.name} · {passengers} pax
                </p>
              </div>
            </div>

            {estimate && (
              <FareSummary
                fare={estimate.fare}
                distanceKm={estimate.distanceKm}
                durationMin={estimate.durationMin}
                availability={estimate.availability}
                approximate={estimate.routeSource === "estimate"}
              />
            )}

            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full name" error={errors.name}>
                  <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} placeholder="Ex. Priya Raman" aria-invalid={Boolean(errors.name) || undefined} />
                </Field>
                <Field label="Mobile number" error={errors.phone}>
                  <div className="flex h-12 items-center rounded-xl border border-transparent bg-secondary transition-[background-color,border-color,box-shadow] focus-within:border-primary focus-within:bg-card focus-within:ring-4 focus-within:ring-primary/10 dark:bg-white/[0.05]">
                    <span className="ml-4 mr-3 border-r pr-3 text-[15px] font-medium">+91</span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^\d\s+]/g, ""))}
                      inputMode="tel"
                      autoComplete="tel-national"
                      maxLength={14}
                      aria-invalid={Boolean(errors.phone) || undefined}
                      aria-label="Mobile number"
                      placeholder="98765 43210"
                      className="h-full w-full bg-transparent pr-3 text-[15px] outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </Field>
              </div>
              <Field label="Email" error={errors.email} hint={customer ? undefined : "We’ll send a one-time code to verify it"}>
                <div className="relative">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    maxLength={254}
                    readOnly={Boolean(customer)}
                    placeholder="example@gmail.com"
                    className={cn(customer && "pr-9 text-muted-foreground")}
                    aria-invalid={Boolean(errors.email) || undefined}
                  />
                  {customer && <LockIcon className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />}
                </div>
              </Field>

              <input
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
              />

              <div className="flex flex-wrap gap-2">
                {!showNote && (
                  <button type="button" onClick={() => setShowNote(true)} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#cfcfcf] text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-accent">
                    <PlusIcon className="size-4" /> Add a note
                  </button>
                )}
                {!showPromo && (
                  <button type="button" onClick={() => setShowPromo(true)} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#cfcfcf] text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-accent">
                    <TagIcon className="size-4" /> Promo code
                  </button>
                )}
              </div>
              {showNote && (
                <Field label="Note for the driver (optional)">
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Luggage, landmark, flight number…" />
                </Field>
              )}
              {showPromo && (
                <Field label="Promo code" error={errors.promoCode}>
                  <div className="flex gap-2">
                    <Input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} maxLength={24} className="uppercase" placeholder="WELCOME100" />
                    <Button type="button" size="xl" className="px-6" onClick={onApplyPromo} disabled={loading || !promo.trim()}>
                      {loading ? <Spinner /> : "Apply"}
                    </Button>
                  </div>
                  {estimate?.promo?.applied && <p className="mt-1 text-xs text-success">✓ {estimate.promo.code} applied</p>}
                </Field>
              )}
              {config.loyaltyEnabled && customer && customer.rewardBalance > 0 && (
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border bg-secondary/50 p-3.5">
                  <span className="flex items-center gap-2.5 text-sm">
                    <WalletIcon className="size-4 text-primary" />
                    Use reward credits <span className="text-muted-foreground">({formatINR(customer.rewardBalance)} available)</span>
                  </span>
                  <Switch
                    checked={useCredits}
                    onCheckedChange={setUseCredits}
                  />
                </label>
              )}
            </div>

            {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}

            <Button size="xl" className="sheen w-full shadow-glow" onClick={onConfirm} disabled={booking || !estimate?.availability.ok}>
              {booking ? <Spinner /> : <ShieldCheckIcon />}
              {booking ? "Booking your ride…" : customer ? "Confirm booking" : "Verify email & book"}
            </Button>
            <p className="text-center text-[11.5px] text-muted-foreground">
              Pay after your ride via UPI or cash. By booking you agree to our{" "}
              <Link href="/terms" className="text-primary underline underline-offset-2">terms</Link> &{" "}
              <Link href="/cancellation-policy" className="text-primary underline underline-offset-2">cancellation policy</Link>.
            </p>
          </div>
        )}

      {otpOpen && (
      <OtpDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        email={email.trim().toLowerCase()}
        name={name.trim()}
        phone={phone.trim()}
        referralCode={referral}
        turnstileSiteKey={config.turnstileSiteKey}
        onVerified={onVerified}
      />
      )}
    </WidgetShell>
  );
}

function WidgetShell({ children, variant }: { children: React.ReactNode; variant: "hero" | "page" }) {
  return (
    <div
      className={cn(
        "relative w-full min-w-0 overflow-hidden rounded-3xl border bg-card text-card-foreground",
        variant === "hero" ? "border-white/10 shadow-[0_40px_80px_-32px_rgb(0_0_0/0.65)] ring-1 ring-black/5" : "shadow-float",
      )}
    >
      {children}
    </div>
  );
}

function TripTabs({ types, value, onChange }: { types: TripType[]; value: TripType; onChange: (t: TripType) => void }) {
  // Segmented control: one white pill slides under the active trip type (CSS transform, no JS animation).
  const index = Math.max(0, types.indexOf(value));
  return (
    <div role="tablist" aria-label="Trip type" className="relative grid rounded-full bg-secondary p-1" style={{ gridTemplateColumns: `repeat(${types.length}, minmax(0, 1fr))` }}>
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-full bg-card shadow-[0_1px_3px_rgb(10_10_10/0.1),0_4px_12px_-4px_rgb(10_10_10/0.12)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ width: `calc((100% - 0.5rem) / ${types.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {types.map((t) => {
        const active = value === t;
        return (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t)}
            className={cn("relative h-9 truncate px-1 text-[12.5px] font-semibold transition-colors sm:text-[13px]", active ? "text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            {TRIP_TYPE_LABEL[t].replace(" Hourly", "").replace(" transfer", "")}
          </button>
        );
      })}
    </div>
  );
}

function AcOption({ active, disabled, onClick, icon: Icon, label }: { active: boolean; disabled: boolean; onClick: () => void; icon: typeof SnowflakeIcon; label: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full text-[13px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 sm:gap-1.5 sm:text-sm",
        active ? "bg-card text-foreground shadow-[0_1px_4px_rgb(1_1_1/0.1)] [&_svg]:text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="hidden size-4 min-[390px]:block" /> {label}
    </button>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  // Wrapping <label> gives every control an accessible name without id plumbing.
  return (
    <div className="space-y-1.5">
      <span className="block text-[13px] font-medium">{label}</span>
      <label className="block" aria-label={label}>
        {children}
      </label>
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ContactButtons({ phone, whatsapp, className }: { phone?: string; whatsapp?: string; className?: string }) {
  if (!phone && !whatsapp) return null;
  return (
    <div className={cn("flex flex-wrap justify-center gap-2", className)}>
      {phone && (
        <Button asChild variant="outline" size="lg">
          <a href={`tel:${phone}`}>
            <PhoneIcon /> Call
          </a>
        </Button>
      )}
      {whatsapp && (
        <Button asChild size="lg" className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
          <a href={`https://wa.me/${phoneDigits(whatsapp)}`} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon className="size-4" /> WhatsApp
          </a>
        </Button>
      )}
    </div>
  );
}
