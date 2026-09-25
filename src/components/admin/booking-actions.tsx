"use client";

import { cn } from "cn";
import {
  BanIcon,
  BanknoteIcon,
  CarFrontIcon,
  CheckCircle2Icon,
  CheckIcon,
  FlagIcon,
  KeyRoundIcon,
  MapPinCheckIcon,
  NavigationIcon,
  PencilIcon,
  QrCodeIcon,
  SmartphoneIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FareLines } from "@/components/booking/fare-summary";
import { QrSvg } from "@/components/shared/qr-svg";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { formatINR, toPaise } from "@/lib/format";
import type { BookingStatus, FinalFare, FinalFareInput, PaymentStatus, TripType } from "@/lib/types";
import { AcceptRejectButtons } from "./quick-actions";

type Props = {
  id: string;
  code: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  tripType: TripType;
  finalFare: number | null;
  finalInput: FinalFareInput | null;
  estimateKm: number;
  estimateDays: number;
  packageHours: number | null;
  requirePin: boolean;
  paymentReference: string | null;
  paymentMethod: string | null;
  qr: { size: number; path: string } | null;
  upi: { vpa: string; name: string } | null;
};

async function post(id: string, body: Record<string, unknown>) {
  return api(`/api/admin/bookings/${id}/action`, { body });
}

export function BookingActions(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const run = async (key: string, body: Record<string, unknown>, success: string) => {
    setBusy(key);
    try {
      await post(p.id, body);
      toast.success(success);
      router.refresh();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const big = (k: string, Icon: typeof CheckIcon, label: string, onClick: () => void, variant: "default" | "outline" = "default") => (
    <Button size="xl" variant={variant} className="w-full justify-center" onClick={onClick} disabled={busy !== null}>
      {busy === k ? <Spinner /> : <Icon />} {label}
    </Button>
  );

  return (
    <div className="space-y-3">
      {p.status === "PENDING" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Accepting notifies the customer instantly with your details and their Ride PIN.</p>
          <AcceptRejectButtons bookingId={p.id} />
          <QuoteAccept id={p.id} />
        </div>
      )}

      {p.status === "CONFIRMED" && big("en_route", NavigationIcon, "I’m on the way", () => run("en_route", { action: "en_route" }, "Customer notified: you’re on the way"))}
      {(p.status === "CONFIRMED" || p.status === "EN_ROUTE") &&
        big("arrived", MapPinCheckIcon, "I’ve arrived at pickup", () => run("arrived", { action: "arrived" }, "Customer notified: you’ve arrived"), p.status === "EN_ROUTE" ? "default" : "outline")}
      {["CONFIRMED", "EN_ROUTE", "ARRIVED"].includes(p.status) && big("start", CarFrontIcon, "Start trip", () => setPinOpen(true), p.status === "ARRIVED" ? "default" : "outline")}
      {p.status === "IN_PROGRESS" && big("complete", FlagIcon, "Complete trip & set fare", () => setCompleteOpen(true))}

      {p.status === "COMPLETED" && (p.paymentStatus === "UNPAID" || p.paymentStatus === "CLAIMED") && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Amount due</p>
            <p className="text-3xl font-semibold tabular">{formatINR(p.finalFare ?? 0)}</p>
            {p.paymentStatus === "CLAIMED" && (
              <p className="mt-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary dark:text-primary">
                Customer reports paying via {p.paymentMethod ?? "UPI"}
                {p.paymentReference ? ` · ref ${p.paymentReference}` : ""}. Check your UPI app, then confirm.
              </p>
            )}
          </div>
          {p.qr && (
            <Button size="xl" variant="outline" className="w-full" onClick={() => setQrOpen(true)}>
              <QrCodeIcon /> Show payment QR to customer
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button size="xl" onClick={() => run("paid_upi", { action: "payment", method: "UPI", reference: p.paymentReference ?? undefined }, "Marked as paid via UPI")} disabled={busy !== null}>
              {busy === "paid_upi" ? <Spinner /> : <SmartphoneIcon />} Paid · UPI
            </Button>
            <Button size="xl" variant="outline" onClick={() => run("paid_cash", { action: "payment", method: "CASH" }, "Marked as paid in cash")} disabled={busy !== null}>
              {busy === "paid_cash" ? <Spinner /> : <BanknoteIcon />} Paid · Cash
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {p.paymentStatus === "CLAIMED" && (
              <Button variant="ghost" size="sm" onClick={() => run("reject_claim", { action: "reject_claim", reason: "not received yet" }, "Customer asked to retry payment")} disabled={busy !== null}>
                <XIcon /> Not received
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setCompleteOpen(true)}>
              <PencilIcon /> Edit fare
            </Button>
            <Button variant="ghost" size="sm" onClick={() => run("waive", { action: "payment", method: "OTHER", waived: true }, "Fare waived")} disabled={busy !== null}>
              Waive fare
            </Button>
          </div>
        </div>
      )}

      {p.status === "COMPLETED" && (p.paymentStatus === "PAID" || p.paymentStatus === "WAIVED") && (
        <div className="flex items-center gap-3 rounded-2xl border border-success/40 bg-success/[0.06] p-4">
          <CheckCircle2Icon className="size-6 text-success" />
          <div>
            <p className="font-semibold">{p.paymentStatus === "PAID" ? `Paid · ${formatINR(p.finalFare ?? 0)}` : "Fare waived"}</p>
            <p className="text-sm text-muted-foreground">{p.paymentMethod ? `via ${p.paymentMethod}` : ""}{p.paymentReference ? ` · ref ${p.paymentReference}` : ""}</p>
          </div>
        </div>
      )}

      {["CONFIRMED", "EN_ROUTE", "ARRIVED"].includes(p.status) && (
        <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}>
          <BanIcon /> Cancel booking
        </Button>
      )}

      <PinDialog open={pinOpen} onOpenChange={setPinOpen} requirePin={p.requirePin} onSubmit={(pin, skip) => run("start", { action: "start", pin, skipPin: skip }, "Trip started — drive safe!")} />
      <CompleteDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        p={p}
        mode={p.status === "COMPLETED" ? "update_fare" : "complete"}
        onDone={() => {
          setCompleteOpen(false);
          router.refresh();
        }}
      />
      <CancelDialog open={cancelOpen} onOpenChange={setCancelOpen} onSubmit={async (reason) => (await run("cancel", { action: "cancel", reason }, "Booking cancelled — customer notified")) && setCancelOpen(false)} />
      {p.qr && p.upi && (
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-3xl tabular">{formatINR(p.finalFare ?? 0)}</DialogTitle>
              <DialogDescription>Scan with any UPI app to pay {p.upi.name}</DialogDescription>
            </DialogHeader>
            <div className="rounded-2xl bg-white p-4">
              <QrSvg qr={p.qr} label="Payment QR" />
            </div>
            <p className="text-center font-mono text-sm text-muted-foreground">{p.upi.vpa}</p>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function QuoteAccept({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className="text-sm font-medium text-primary" onClick={() => setOpen(true)}>
        Accept with a fixed quote instead…
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept with a fixed quote</DialogTitle>
            <DialogDescription>Replaces the estimate shown to the customer. You can still finalise the fare after the trip.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className="h-12 pl-7 text-lg" placeholder="4500" />
          </div>
          <DialogFooter>
            <Button
              disabled={busy || !Number(amount)}
              onClick={async () => {
                setBusy(true);
                try {
                  await post(id, { action: "accept", quotedFare: toPaise(Number(amount)), message: `fixed quote ${formatINR(toPaise(Number(amount)))}` });
                  toast.success("Accepted with quote — customer notified");
                  setOpen(false);
                  router.refresh();
                } catch (err) {
                  toast.error(errorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy && <Spinner />} Accept at {amount ? formatINR(toPaise(Number(amount) || 0)) : "quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PinDialog({ open, onOpenChange, requirePin, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; requirePin: boolean; onSubmit: (pin: string | undefined, skip: boolean) => Promise<boolean> }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const handleOpenChange = (o: boolean) => {
    if (!o) setPin("");
    onOpenChange(o);
  };
  const submit = async (value: string | undefined, skip: boolean) => {
    setBusy(true);
    const ok = await onSubmit(value, skip);
    setBusy(false);
    if (ok) handleOpenChange(false);
    else setPin("");
  };
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="items-center text-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <KeyRoundIcon className="size-6" />
          </div>
          <DialogTitle>Ride PIN</DialogTitle>
          <DialogDescription>Ask the customer for their 4-digit PIN to confirm you’re picking up the right person.</DialogDescription>
        </DialogHeader>
        {requirePin ? (
          <>
            <div className="flex justify-center">
              <InputOTP maxLength={4} value={pin} onChange={setPin} inputMode="numeric" autoFocus disabled={busy} onComplete={(v: string) => void submit(v, false)}>
                <InputOTPGroup className="gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <InputOTPSlot key={i} index={i} className="size-14 rounded-xl border text-2xl font-semibold first:rounded-xl last:rounded-xl" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <button type="button" className="text-center text-xs text-muted-foreground underline underline-offset-2" onClick={() => void submit(undefined, true)} disabled={busy}>
              Customer can’t access PIN — start anyway (logged)
            </button>
          </>
        ) : (
          <Button size="xl" onClick={() => void submit(undefined, true)} disabled={busy}>
            {busy && <Spinner />} Start trip now
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (reason: string) => void }) {
  const reasons = ["Customer no-show", "Customer requested cancellation", "Vehicle breakdown", "Emergency"];
  const [reason, setReason] = useState(reasons[0]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
          <DialogDescription>The customer will be notified with this reason. Any credits used are refunded automatically.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {reasons.map((r) => (
            <Button key={r} size="sm" variant={reason === r ? "default" : "outline"} onClick={() => setReason(r)}>
              {r}
            </Button>
          ))}
        </div>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep booking</Button>
          <Button variant="destructive" disabled={reason.trim().length < 3} onClick={() => onSubmit(reason.trim())}>
            Cancel booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const MONEY_FIELDS: { key: keyof FinalFareInput; label: string }[] = [
  { key: "tolls", label: "Tolls" },
  { key: "parking", label: "Parking" },
  { key: "permit", label: "State permit" },
  { key: "waiting", label: "Waiting charges" },
  { key: "other", label: "Other" },
  { key: "extraDiscount", label: "Courtesy discount" },
];

function CompleteDialog({ open, onOpenChange, p, mode, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; p: Props; mode: "complete" | "update_fare"; onDone: () => void }) {
  const init = p.finalInput;
  const [km, setKm] = useState(String(init?.actualKm ?? (p.tripType === "LOCAL" ? "" : p.estimateKm)));
  const [hours, setHours] = useState(String(init?.actualHours ?? p.packageHours ?? ""));
  const [days, setDays] = useState(String(init?.days ?? p.estimateDays));
  const [money, setMoney] = useState<Record<string, string>>(() =>
    Object.fromEntries(MONEY_FIELDS.map((f) => [f.key, init?.[f.key] ? String((init[f.key] as number) / 100) : ""])),
  );
  const [otherLabel, setOtherLabel] = useState(init?.otherLabel ?? "");
  const [override, setOverride] = useState(init?.overrideTotal !== undefined ? String(init.overrideTotal / 100) : "");
  const [preview, setPreview] = useState<FinalFare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const input = useMemo<FinalFareInput>(() => {
    const out: FinalFareInput = {};
    if (km !== "" && Number.isFinite(Number(km))) out.actualKm = Number(km);
    if (p.tripType === "LOCAL" && hours !== "" && Number.isFinite(Number(hours))) out.actualHours = Number(hours);
    if (p.tripType === "ROUND_TRIP" && Number(days) >= 1) out.days = Math.round(Number(days));
    for (const f of MONEY_FIELDS) {
      const v = Number(money[f.key]);
      if (money[f.key] !== "" && Number.isFinite(v) && v > 0) (out as Record<string, number>)[f.key] = toPaise(v);
    }
    if (otherLabel.trim()) out.otherLabel = otherLabel.trim();
    if (override !== "" && Number.isFinite(Number(override))) out.overrideTotal = toPaise(Number(override));
    return out;
  }, [km, hours, days, money, otherLabel, override, p.tripType]);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await api<{ fare: FinalFare }>(`/api/admin/bookings/${p.id}/fare-preview`, { body: input, signal: ctrl.signal });
        setPreview(r.fare);
        setError(null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(err instanceof ApiClientError ? err.message : "Couldn’t calculate");
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [input, open, p.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "complete" ? "Complete trip" : "Edit final fare"}</DialogTitle>
          <DialogDescription>Enter actual usage and extras. The bill updates live; the customer sees it with a UPI QR instantly.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={p.tripType === "ROUND_TRIP" ? "Total km driven" : p.tripType === "LOCAL" ? "Km used" : "Actual km"}>
                <Input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value.replace(/[^\d.]/g, ""))} />
              </Field>
              {p.tripType === "LOCAL" && (
                <Field label="Hours used">
                  <Input inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value.replace(/[^\d.]/g, ""))} />
                </Field>
              )}
              {p.tripType === "ROUND_TRIP" && (
                <Field label="Days">
                  <Input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} />
                </Field>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {MONEY_FIELDS.map((f) => (
                <Field key={f.key} label={`${f.label} (₹)`}>
                  <Input inputMode="decimal" value={money[f.key]} onChange={(e) => setMoney((m) => ({ ...m, [f.key]: e.target.value.replace(/[^\d.]/g, "") }))} placeholder="0" />
                </Field>
              ))}
            </div>
            {money.other && (
              <Field label="Other charge label">
                <Input value={otherLabel} onChange={(e) => setOtherLabel(e.target.value)} maxLength={40} placeholder="e.g. Hill station entry" />
              </Field>
            )}
            <Field label="Override total (₹, optional)">
              <Input inputMode="decimal" value={override} onChange={(e) => setOverride(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Leave empty to use calculated" />
            </Field>
          </div>
          <div className={cn("rounded-2xl border bg-muted/30 p-4", !preview && "grid place-items-center")}>
            {preview ? (
              <>
                <FareLines fare={preview} />
                <div className="mt-4 flex justify-between border-t pt-3 text-lg font-semibold">
                  <span>Customer pays</span>
                  <span className="tabular">{formatINR(preview.amountDue)}</span>
                </div>
              </>
            ) : (
              <Spinner />
            )}
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            size="lg"
            disabled={busy || !preview}
            onClick={async () => {
              setBusy(true);
              try {
                await post(p.id, { action: mode, fare: input });
                toast.success(mode === "complete" ? "Trip completed — payment request sent to customer" : "Fare updated");
                onDone();
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Spinner /> : <CheckIcon />} {mode === "complete" ? `Complete · ${preview ? formatINR(preview.amountDue) : ""}` : "Save fare"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
