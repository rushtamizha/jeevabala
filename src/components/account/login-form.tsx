"use client";

import { cn } from "cn";
import { ArrowRightIcon, MailIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { OtpPanel, useOtpFlow } from "@/components/booking/otp-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
type Mode = "signin" | "register";

/**
 * Password-free auth: "Sign in" asks for an email, "Create account" also
 * collects name + mobile. Both finish with the same one-time code, and the
 * verify call creates the account on first use.
 */
export function AuthForm({ next, turnstileSiteKey, initialMode = "signin" }: { next: string; turnstileSiteKey?: string; initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<"details" | "code">("details");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Referral code captured by the booking widget (?ref=…); read once on the client, never rendered.
  const [referral] = useState<string | undefined>(() => {
    try {
      return typeof window === "undefined" ? undefined : (localStorage.getItem("sa_ref") ?? undefined);
    } catch {
      return undefined;
    }
  });

  const flow = useOtpFlow({
    email: email.trim().toLowerCase(),
    name: mode === "register" ? name.trim() : undefined,
    phone: mode === "register" ? phone.trim() : undefined,
    referralCode: mode === "register" ? referral : undefined,
    turnstileSiteKey,
    onVerified: (c, isNew) => {
      toast.success(isNew ? `Welcome aboard${c.name ? `, ${c.name.split(" ")[0]}` : ""}!` : `Welcome back${c.name ? `, ${c.name.split(" ")[0]}` : ""}!`);
      router.replace(next);
      router.refresh();
    },
  });

  function validate() {
    const e: Record<string, string> = {};
    if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email address";
    if (mode === "register") {
      if (name.trim().length < 2) e.name = "Enter your full name";
      const d = phone.replace(/\D/g, "");
      if (!(d.length === 10 || (d.length === 12 && d.startsWith("91")))) e.phone = "Enter a valid 10-digit mobile number";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const switchMode = (m: Mode) => {
    setMode(m);
    setErrors({});
    flow.setError(null);
  };

  if (step === "code") {
    return (
      <div className="animate-in fade-in-0 slide-in-from-right-2 duration-300">
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.03em]">Check your inbox</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Enter the 6-digit code we just emailed you. It expires in 10 minutes.</p>
        <div className="mt-7">
          <OtpPanel flow={flow} turnstileSiteKey={turnstileSiteKey} onEditEmail={() => setStep("details")} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.03em]">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {mode === "signin" ? "Sign in to track rides, download receipts and use your rewards." : "Book faster, earn rewards on every trip and keep every receipt in one place."}
      </p>

      <div role="tablist" aria-label="Account" className="relative mt-7 grid grid-cols-2 rounded-full bg-secondary p-1">
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-card shadow-[0_1px_3px_rgb(10_10_10/0.1),0_4px_12px_-4px_rgb(10_10_10/0.12)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(${mode === "signin" ? 0 : 100}%)` }}
        />
        {(["signin", "register"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => switchMode(m)} className={cn("relative h-10 text-sm font-semibold transition-colors", mode === m ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form
        noValidate
        className="mt-5 space-y-3.5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!validate()) return;
          setStep("code");
          if (!turnstileSiteKey) await flow.send();
        }}
      >
        {mode === "register" && (
          <div className="grid gap-3.5 animate-in fade-in-0 slide-in-from-top-1 duration-300">
            <Field id="name" label="Full name" error={errors.name}>
              <div className="relative">
                <UserRoundIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="name" autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Raman" className="pl-11" aria-invalid={Boolean(errors.name) || undefined} />
              </div>
            </Field>
            <Field id="phone" label="Mobile number" error={errors.phone}>
              <div className="flex h-12 items-center rounded-xl border border-transparent bg-secondary transition-[background-color,border-color,box-shadow] focus-within:border-primary focus-within:bg-card focus-within:ring-4 focus-within:ring-primary/10">
                <span className="ml-4 mr-3 border-r pr-3 text-[15px] font-medium">+91</span>
                <input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d\s+]/g, ""))}
                  inputMode="tel"
                  autoComplete="tel-national"
                  maxLength={14}
                  placeholder="98765 43210"
                  aria-invalid={Boolean(errors.phone) || undefined}
                  className="h-full w-full bg-transparent pr-3 text-[15px] outline-none placeholder:text-muted-foreground"
                />
              </div>
            </Field>
          </div>
        )}
        <Field id="email" label="Email" error={errors.email}>
          <div className="relative">
            <MailIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="email" autoFocus maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" className="pl-11" aria-invalid={Boolean(errors.email) || undefined} />
          </div>
        </Field>
        {flow.error && <p className="text-sm text-destructive" role="alert">{flow.error}</p>}
        <Button type="submit" size="xl" className="sheen w-full shadow-glow">
          {mode === "signin" ? "Continue with email" : "Create account"} <ArrowRightIcon />
        </Button>
      </form>

      <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
        {mode === "signin" ? (
          <>New here? Signing in with a new email creates your account automatically.</>
        ) : (
          <>
            By continuing you agree to our{" "}
            <Link href="/terms" className="font-medium text-foreground underline underline-offset-2">terms</Link> and{" "}
            <Link href="/privacy" className="font-medium text-foreground underline underline-offset-2">privacy policy</Link>.
          </>
        )}
      </p>
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
