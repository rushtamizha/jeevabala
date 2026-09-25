"use client";

import { cn } from "cn";
import { motion } from "framer-motion";
import { BanknoteIcon, CheckCircle2Icon, ExternalLinkIcon, HourglassIcon, QrCodeIcon, ReceiptIcon, SmartphoneIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { CopyButton } from "@/components/shared/copy-button";
import { QrSvg } from "@/components/shared/qr-svg";
import { SuccessBadge } from "@/components/shared/success-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { api, errorMessage } from "@/lib/api-client";
import { formatINR } from "@/lib/format";
import type { CustomerBookingDetail } from "@/lib/server/customer-bookings";
import { upiAppLinks } from "@/lib/upi";

const noopSubscribe = () => () => {};
function useUserAgent(re: RegExp) {
  return useSyncExternalStore(noopSubscribe, () => re.test(navigator.userAgent), () => false);
}

export function PaymentPanel({ data }: { data: CustomerBookingDetail }) {
  const router = useRouter();
  const { booking: b, payment } = data;
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState<"UPI" | "CASH" | null>(null);
  const isIos = useUserAgent(/iPhone|iPad|iPod/i);
  const isMobile = useUserAgent(/Android|iPhone|iPad|iPod/i);

  if (b.paymentStatus === "PAID" || b.paymentStatus === "WAIVED") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl border bg-card px-6 py-10 text-center">
        <SuccessBadge tone="success" />
        <h3 className="mt-5 text-2xl font-semibold tracking-tight">{b.paymentStatus === "WAIVED" ? "No payment needed" : "Payment successful!"}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {b.paymentStatus === "WAIVED" ? "This trip was on us. Thank you!" : `${formatINR(b.finalFare ?? 0)} via ${b.paymentMethod ?? "UPI"}. Thank you for riding with us!`}
        </p>
        <div className="mx-auto mt-6 flex max-w-xs flex-col gap-2">
          <Button asChild size="xl">
            <Link href={`/account/bookings/${b.code}/receipt`}>
              <ReceiptIcon /> View e-receipt
            </Link>
          </Button>
          <Button asChild variant="ghost" className="text-primary">
            <Link href="/book">Book another ride</Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  if (!payment.open || payment.amountDue === null) return null;

  if (b.paymentStatus === "CLAIMED") {
    return (
      <div className="rounded-xl border border-primary/40 bg-primary/[0.06] p-6 text-center">
        <HourglassIcon className="mx-auto size-9 text-primary" />
        <h3 className="mt-3 text-lg font-semibold">Verifying your payment</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The driver will confirm receipt of {formatINR(payment.amountDue)} shortly{b.paymentReference ? ` (ref ${b.paymentReference})` : ""}. This page updates automatically.
        </p>
      </div>
    );
  }

  const claim = async (method: "UPI" | "CASH") => {
    setBusy(method);
    try {
      await api(`/api/account/bookings/${b.code}/payment`, { body: { method, reference: method === "UPI" && utr.trim() ? utr.trim() : undefined } });
      toast.success(method === "UPI" ? "Thanks! We’ll confirm your payment shortly." : "Noted — the driver will confirm the cash payment.");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const upi = payment.upi;
  const apps = upi ? upiAppLinks({ vpa: upi.vpa, name: upi.name, amountPaise: upi.amountPaise, note: upi.note }) : [];

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-premium">
      <div className="flex items-center justify-between gap-4 bg-primary p-5 text-primary-foreground sm:p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary-foreground/75">Amount due</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular">{formatINR(payment.amountDue)}</p>
        </div>
        <QrCodeIcon className="size-10 opacity-60" />
      </div>
      <div className="space-y-6 p-5 sm:p-6">
        {upi ? (
          <div className="grid gap-6 sm:grid-cols-[220px_1fr] sm:items-center">
            <div className="mx-auto w-full max-w-[220px] rounded-2xl border bg-white p-3 shadow-sm">
              <QrSvg qr={upi.qr} label={`UPI QR code to pay ${formatINR(upi.amountPaise)} to ${upi.name}`} />
              <p className="mt-2 text-center text-[11px] font-medium text-zinc-500">Scan with any UPI app</p>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Pay to</p>
                <p className="font-semibold">{upi.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded-md bg-muted px-2 py-1 text-sm">{upi.vpa}</code>
                  <CopyButton value={upi.vpa} label="Copy" />
                </div>
              </div>
              {isMobile && (
                <Button asChild size="xl" className="w-full">
                  <a href={isIos ? apps[0].href : upi.uri}>
                    <SmartphoneIcon /> Pay {formatINR(upi.amountPaise)} with UPI app
                  </a>
                </Button>
              )}
              <div className="grid grid-cols-2 gap-2">
                {apps.map((a) => (
                  <Button key={a.id} asChild variant="outline" size="lg" className={cn(!isMobile && "pointer-events-none opacity-60")}>
                    <a href={a.href} aria-disabled={!isMobile}>
                      {a.name} <ExternalLinkIcon className="size-3" />
                    </a>
                  </Button>
                ))}
              </div>
              {!isMobile && <p className="text-xs text-muted-foreground">On a computer? Scan the QR with your phone’s UPI app.</p>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Please pay the driver directly{payment.cashEnabled ? " in cash or" : ""} via UPI.</p>
        )}

        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">{payment.instructions}</p>

        <div className="space-y-3 border-t pt-5">
          {upi && (
            <div className="space-y-1.5">
              <Label htmlFor="utr">UPI reference / UTR (optional, speeds up confirmation)</Label>
              <div className="flex gap-2">
                <Input id="utr" value={utr} onChange={(e) => setUtr(e.target.value.replace(/[^A-Za-z0-9-]/g, "").slice(0, 40))} placeholder="e.g. 425012345678" inputMode="numeric" className="h-11 rounded-xl" />
                <Button size="lg" className="h-11 rounded-xl px-5" onClick={() => claim("UPI")} disabled={busy !== null}>
                  {busy === "UPI" ? <Spinner /> : <CheckCircle2Icon />} I’ve paid
                </Button>
              </div>
            </div>
          )}
          {payment.cashEnabled && (
            <Button variant="ghost" className="w-full" onClick={() => claim("CASH")} disabled={busy !== null}>
              {busy === "CASH" ? <Spinner /> : <BanknoteIcon />} I paid the driver in cash
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
