"use client";

import { EyeIcon, EyeOffIcon, KeyRoundIcon, LockIcon, MailIcon, ShieldCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { api, errorMessage } from "@/lib/api-client";

export function AdminLoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "mfa">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitMfa(value: string) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/auth/mfa", { body: { code: value } });
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setCode("");
      setBusy(false);
    }
  }

  if (step === "mfa") {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3 text-sm">
          <ShieldCheckIcon className="size-5 text-primary" />
          {useRecovery ? "Enter one of your recovery codes." : "Enter the 6-digit code from your authenticator app."}
        </div>
        {useRecovery ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitMfa(code);
            }}
            className="space-y-3"
          >
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXXX-XXXXX" className="h-12 rounded-xl font-mono tracking-widest" autoFocus maxLength={11} />
            <Button type="submit" size="xl" className="w-full" disabled={busy || code.length < 10}>
              {busy && <Spinner />} Verify
            </Button>
          </form>
        ) : (
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={(v: string) => void submitMfa(v)} autoFocus inputMode="numeric" autoComplete="one-time-code" disabled={busy}>
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className="size-12 rounded-xl border text-lg font-semibold first:rounded-xl last:rounded-xl" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
        )}
        {error && <p className="text-center text-sm text-destructive" role="alert">{error}</p>}
        <button type="button" className="w-full text-center text-sm font-medium text-primary" onClick={() => { setUseRecovery((v) => !v); setCode(""); setError(null); }}>
          {useRecovery ? "Use authenticator code" : "Use a recovery code"}
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await api<{ mfaRequired: boolean }>("/api/admin/auth/login", { body: { email, password } });
          setPassword("");
          if (r.mfaRequired) {
            setStep("mfa");
            setBusy(false);
          } else {
            router.replace("/admin");
            router.refresh();
          }
        } catch (err) {
          setError(errorMessage(err));
          setBusy(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="admin-email">Email</Label>
        <div className="relative">
          <MailIcon className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="admin-email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl pl-10" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="admin-password">Password</Label>
        <div className="relative">
          <LockIcon className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="admin-password" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl pl-10 pr-11" />
          <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground">
            {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" size="xl" className="w-full" disabled={busy}>
        {busy ? <Spinner /> : <KeyRoundIcon />} Sign in securely
      </Button>
    </form>
  );
}
