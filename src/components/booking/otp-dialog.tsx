"use client";

import { MailCheckIcon, PencilIcon, ShieldCheckIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import { Turnstile } from "@/components/shared/turnstile";
import { ApiClientError, api, errorMessage } from "@/lib/api-client";

export type VerifiedCustomer = { name: string; email: string; phone: string | null; rewardBalance: number };

export function useOtpFlow(opts: {
  email: string;
  name?: string;
  phone?: string;
  referralCode?: string;
  turnstileSiteKey?: string;
  onVerified: (c: VerifiedCustomer, isNew: boolean) => void;
}) {
  const [stage, setStage] = useState<"idle" | "sending" | "sent" | "verifying">("idle");
  const [masked, setMasked] = useState("");
  const [devHint, setDevHint] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const send = useCallback(async () => {
    if (opts.turnstileSiteKey && !turnstileToken) {
      setError("Please complete the security check below.");
      return;
    }
    setStage("sending");
    setError(null);
    try {
      const r = await api<{ maskedEmail: string; resendInSec: number; devHint?: boolean }>("/api/auth/otp/request", {
        body: { email: opts.email, turnstileToken: turnstileToken ?? undefined },
      });
      setMasked(r.maskedEmail);
      setDevHint(Boolean(r.devHint));
      setResendIn(r.resendInSec);
      setStage("sent");
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 429 && err.retryAfterSec) {
        setResendIn(err.retryAfterSec);
        setStage("sent");
      } else setStage("idle");
      setError(errorMessage(err));
    }
  }, [opts.email, opts.turnstileSiteKey, turnstileToken]);

  const verify = useCallback(
    async (value: string) => {
      setStage("verifying");
      setError(null);
      try {
        const r = await api<{ customer: VerifiedCustomer; isNew: boolean }>("/api/auth/otp/verify", {
          body: {
            email: opts.email,
            code: value,
            name: opts.name || undefined,
            phone: opts.phone || undefined,
            referralCode: opts.referralCode || undefined,
          },
        });
        opts.onVerified(r.customer, r.isNew);
      } catch (err) {
        setStage("sent");
        setCode("");
        setError(errorMessage(err));
      }
    },
    [opts],
  );

  return { stage, masked, devHint, resendIn, error, code, setCode, send, verify, setTurnstileToken, setError };
}

export function OtpPanel({ flow, turnstileSiteKey, onEditEmail }: { flow: ReturnType<typeof useOtpFlow>; turnstileSiteKey?: string; onEditEmail?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (flow.stage === "sent") inputRef.current?.focus();
  }, [flow.stage]);

  return (
    <div className="space-y-5">
      {flow.stage === "idle" || flow.stage === "sending" ? (
        <div className="space-y-4">
          {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} onToken={flow.setTurnstileToken} />}
          <Button size="xl" className="w-full" onClick={flow.send} disabled={flow.stage === "sending"}>
            {flow.stage === "sending" ? <Spinner /> : <MailCheckIcon />} Send verification code
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm">
            <span className="text-muted-foreground">
              Code sent to <span className="font-medium text-foreground">{flow.masked}</span>
            </span>
            {onEditEmail && (
              <button type="button" onClick={onEditEmail} className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                <PencilIcon className="size-3" /> Change
              </button>
            )}
          </div>
          <div className="flex justify-center">
            <InputOTP
              ref={inputRef}
              maxLength={6}
              inputMode="numeric"
              pattern="^[0-9]*$"
              autoComplete="one-time-code"
              value={flow.code}
              onChange={(v) => {
                flow.setCode(v);
                if (flow.error) flow.setError(null);
              }}
              onComplete={(v: string) => void flow.verify(v)}
              disabled={flow.stage === "verifying"}
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    aria-invalid={Boolean(flow.error) || undefined}
                    className="size-12 rounded-xl border text-lg font-semibold first:rounded-xl last:rounded-xl sm:size-13"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          {flow.devHint && (
            <p className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-center text-xs text-primary dark:text-primary">
              Development mode: email isn’t configured, so the code is printed in the server console.
            </p>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              {flow.stage === "verifying" ? <Spinner className="size-3.5" /> : <ShieldCheckIcon className="size-3.5" />}
              {flow.stage === "verifying" ? "Verifying…" : "Expires in 10 minutes"}
            </span>
            <button
              type="button"
              disabled={flow.resendIn > 0}
              onClick={flow.send}
              className="font-medium text-primary disabled:cursor-not-allowed disabled:text-muted-foreground"
            >
              {flow.resendIn > 0 ? `Resend in ${flow.resendIn}s` : "Resend code"}
            </button>
          </div>
        </>
      )}
      {flow.error && <p className="text-center text-sm text-destructive" role="alert">{flow.error}</p>}
    </div>
  );
}

export function OtpDialog({
  open,
  onOpenChange,
  email,
  name,
  phone,
  referralCode,
  turnstileSiteKey,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  email: string;
  name?: string;
  phone?: string;
  referralCode?: string;
  turnstileSiteKey?: string;
  onVerified: (c: VerifiedCustomer, isNew: boolean) => void;
}) {
  const flow = useOtpFlow({ email, name, phone, referralCode, turnstileSiteKey, onVerified });
  const sentFor = useRef<string | null>(null);
  useEffect(() => {
    if (open && !turnstileSiteKey && sentFor.current !== email) {
      sentFor.current = email;
      void flow.send();
    }
    if (!open) sentFor.current = null;
  }, [open, email, turnstileSiteKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="mb-1 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheckIcon className="size-6" />
          </div>
          <DialogTitle className="text-xl">Verify your email</DialogTitle>
          <DialogDescription>
            A one-time check keeps your bookings private and protects you from fake bookings in your name.
          </DialogDescription>
        </DialogHeader>
        <OtpPanel flow={flow} turnstileSiteKey={turnstileSiteKey} onEditEmail={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
