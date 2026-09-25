"use client";

import { CopyIcon, KeyRoundIcon, LaptopIcon, LogOutIcon, ShieldCheckIcon, ShieldOffIcon, SmartphoneIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { QrSvg } from "@/components/shared/qr-svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { formatRelative } from "@/lib/format";
import { FormField } from "./form-kit";

export function PasswordPanel() {
  const router = useRouter();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (next !== confirm) {
          setErrors({ confirm: "Passwords don’t match" });
          return;
        }
        setBusy(true);
        setErrors({});
        try {
          await api("/api/admin/security/password", { body: { current: cur, next } });
          toast.success("Password changed. Other devices were signed out.");
          setCur("");
          setNext("");
          setConfirm("");
          router.refresh();
        } catch (err) {
          if (err instanceof ApiClientError) setErrors(err.fields);
          toast.error(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <FormField label="Current password" error={errors.current}><Input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></FormField>
      <FormField label="New password" hint="12+ characters, mixing letters, numbers & symbols" error={errors.next}><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={12} /></FormField>
      <FormField label="Confirm new password" error={errors.confirm}><Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></FormField>
      <Button type="submit" disabled={busy || !cur || !next}>{busy ? <Spinner /> : <KeyRoundIcon />} Update password</Button>
    </form>
  );
}

export function TwoFactorPanel({ enabled, recoveryLeft }: { enabled: boolean; recoveryLeft: number }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ secret: string; qr: { size: number; path: string } } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const call = async <T,>(body: Record<string, unknown>): Promise<T | null> => {
    setBusy(true);
    try {
      return await api<T>("/api/admin/security/totp", { body });
    } catch (err) {
      toast.error(errorMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (codes) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">
          Save these recovery codes somewhere safe (password manager or printed). Each works once if you lose your phone. They won’t be shown again.
        </p>
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
          {codes.map((c) => (
            <li key={c} className="rounded-lg bg-secondary px-3 py-2 text-center">{c}</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(codes.join("\n")).then(() => toast.success("Copied"))}><CopyIcon /> Copy</Button>
          <Button onClick={() => { setCodes(null); router.refresh(); }}>I’ve saved them</Button>
        </div>
      </div>
    );
  }

  if (enabled) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm"><ShieldCheckIcon className="size-5 text-success" /> Two-factor authentication is <span className="font-semibold">on</span>. {recoveryLeft} recovery codes left.</p>
        <FormField label="Confirm with your password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></FormField>
        <div className="flex flex-wrap items-end gap-2">
          <Button variant="outline" disabled={busy || !password} onClick={async () => { const r = await call<{ recoveryCodes: string[] }>({ action: "recovery", password }); if (r) { setCodes(r.recoveryCodes); setPassword(""); } }}>
            New recovery codes
          </Button>
          <div className="flex items-center gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" className="w-32" inputMode="numeric" />
            <Button variant="destructive" disabled={busy || !password || code.length !== 6} onClick={async () => { if (await call({ action: "disable", password, code })) { toast.success("2FA disabled"); setPassword(""); setCode(""); router.refresh(); } }}>
              <ShieldOffIcon /> Disable
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (setup) {
    return (
      <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
        <div className="rounded-2xl border bg-white p-3"><QrSvg qr={setup.qr} label="Authenticator setup QR code" /></div>
        <div className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Open Google Authenticator, Microsoft Authenticator, 1Password or Authy.</li>
            <li>Scan the QR code (or enter the key below).</li>
            <li>Enter the 6-digit code shown in the app.</li>
          </ol>
          <code className="block break-all rounded-lg bg-secondary px-3 py-2 text-xs">{setup.secret}</code>
          <InputOTP maxLength={6} value={code} onChange={setCode} inputMode="numeric" disabled={busy}
            onComplete={async (v: string) => {
              const r = await call<{ recoveryCodes: string[] }>({ action: "enable", code: v });
              if (r) { setCodes(r.recoveryCodes); setSetup(null); toast.success("Two-factor authentication enabled"); }
              else setCode("");
            }}>
            <InputOTPGroup className="gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} className="size-11 rounded-xl text-base font-semibold" />)}
            </InputOTPGroup>
          </InputOTP>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Even if your password leaks, nobody can sign in without the code from your phone. Strongly recommended.</p>
      <Button disabled={busy} onClick={async () => { const r = await call<{ secret: string; qr: { size: number; path: string } }>({ action: "setup" }); if (r) setSetup(r); }}>
        {busy ? <Spinner /> : <SmartphoneIcon />} Set up authenticator app
      </Button>
    </div>
  );
}

export function SessionsPanel({ sessions, currentId }: { sessions: { id: string; ip: string | null; userAgent: string | null; lastSeenAt: string; createdAt: string }[]; currentId: string }) {
  const router = useRouter();
  const revoke = async (id: string) => {
    try {
      await api(`/api/admin/security/sessions/${id}`, { method: "DELETE" });
      toast.success(id === "others" ? "Signed out of all other devices" : "Session revoked");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const device = (ua: string | null) => {
    if (!ua) return "Unknown device";
    const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Device";
    const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
    return `${br} on ${os}`;
  };
  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-xl border">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            {/Mobile|Android|iPhone/.test(s.userAgent ?? "") ? <SmartphoneIcon className="size-4 text-muted-foreground" /> : <LaptopIcon className="size-4 text-muted-foreground" />}
            <span className="min-w-0 flex-1">
              <span className="font-medium">{device(s.userAgent)}</span> {s.id === currentId && <span className="ml-1 rounded-full bg-success/8 px-2 py-0.5 text-[10px] font-semibold text-success ring-1 ring-success/40">This device</span>}
              <span className="block text-xs text-muted-foreground">{s.ip ?? "—"} · active {formatRelative(s.lastSeenAt)}</span>
            </span>
            {s.id !== currentId && <Button size="sm" variant="ghost" onClick={() => revoke(s.id)}>Revoke</Button>}
          </li>
        ))}
      </ul>
      {sessions.length > 1 && <Button variant="outline" size="sm" onClick={() => revoke("others")}><LogOutIcon /> Sign out all other devices</Button>}
    </div>
  );
}
