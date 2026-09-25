"use client";

import { cn } from "cn";
import { CheckCircle2Icon, CircleDashedIcon, LockIcon, MailIcon, RadarIcon, SendIcon, WebhookIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { TelegramIcon, WhatsAppIcon } from "@/components/shared/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { api, errorMessage } from "@/lib/api-client";
import type { IntegrationsAdminView } from "@/lib/server/settings";
import { FormField, TextInput } from "./form-kit";

function StatusPill({ ok, source }: { ok: boolean; source: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", ok ? "bg-success/12 text-success dark:text-success" : "bg-muted text-muted-foreground")}>
      {ok ? <CheckCircle2Icon className="size-3.5" /> : <CircleDashedIcon className="size-3.5" />}
      {ok ? "Connected" : "Not connected"}
      {source === "env" && " · via environment"}
    </span>
  );
}

/** Write-only secret field: never shows the stored value, only a masked hint. */
function SecretInput({ hint, value, onChange, placeholder }: { hint: string | null; value: string | undefined; onChange: (v: string | undefined) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <LockIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="password"
        autoComplete="new-password"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        placeholder={hint ? `Saved (${hint}) — type to replace` : placeholder ?? "Paste secret"}
        className="h-10 rounded-lg pl-8 font-mono text-sm"
      />
    </div>
  );
}

function Card({ icon, title, description, status, children }: { icon: React.ReactNode; title: string; description: string; status: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">{icon}</span>
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {status}
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

export function IntegrationsForm({ initial, appUrlIsHttps }: { initial: IntegrationsAdminView; appUrlIsHttps: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const [tgToken, setTgToken] = useState<string | undefined>();
  const [tgChat, setTgChat] = useState(initial.telegram.chatId);

  const [wa, setWa] = useState({
    provider: initial.whatsapp.provider,
    adminNumber: initial.whatsapp.adminNumber,
    metaPhoneNumberId: initial.whatsapp.metaPhoneNumberId,
    metaTemplate: initial.whatsapp.metaTemplate,
    metaTemplateLang: initial.whatsapp.metaTemplateLang,
    metaApiVersion: initial.whatsapp.metaApiVersion,
    twilioSid: initial.whatsapp.twilioSid,
    twilioFrom: initial.whatsapp.twilioFrom,
  });
  const [waSecrets, setWaSecrets] = useState<{ metaToken?: string; twilioToken?: string; callmebotApiKey?: string }>({});

  const [smtp, setSmtp] = useState({
    host: initial.smtp.host,
    port: initial.smtp.port,
    secure: initial.smtp.secure,
    user: initial.smtp.user,
    from: initial.smtp.from,
  });
  const [smtpPass, setSmtpPass] = useState<string | undefined>();

  const call = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const save = (key: string, body: Record<string, unknown>) =>
    call(key, () => api("/api/admin/integrations", { method: "PUT", body }), "Saved securely (encrypted at rest)");
  const test = (channel: "telegram" | "whatsapp" | "email") =>
    call(`test-${channel}`, () => api("/api/admin/integrations/test", { body: { channel } }), "Test message sent — check your device");

  return (
    <div className="space-y-5">
      <Card
        icon={<TelegramIcon className="size-5 text-[#229ED9]" />}
        title="Telegram bot"
        description="Instant ride alerts on your phone with one-tap Accept / Decline. Free and reliable."
        status={<StatusPill ok={initial.telegram.configured} source={initial.telegram.source} />}
      >
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>In Telegram, open <span className="font-medium text-foreground">@BotFather</span>, send <code>/newbot</code> and copy the token.</li>
          <li>Paste it below and save. Then open your new bot and press <span className="font-medium text-foreground">Start</span>.</li>
          <li>Click <span className="font-medium text-foreground">Detect my chat</span>, then send a test.</li>
        </ol>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Bot token">
            <SecretInput hint={initial.telegram.botTokenHint} value={tgToken} onChange={setTgToken} placeholder="123456789:AA…" />
          </FormField>
          <FormField label="Your chat ID">
            <TextInput value={tgChat} onChange={(x) => setTgChat(x.replace(/[^\d-]/g, ""))} placeholder="Auto-detected" />
          </FormField>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save("tg", { telegram: { botToken: tgToken, chatId: tgChat } })} disabled={busy !== null}>
            {busy === "tg" && <Spinner />} Save
          </Button>
          <Button variant="outline" onClick={() => call("detect", () => api("/api/admin/integrations/telegram", { body: { action: "detect_chat" } }), "Chat detected and saved")} disabled={busy !== null}>
            {busy === "detect" ? <Spinner /> : <RadarIcon />} Detect my chat
          </Button>
          <Button variant="outline" onClick={() => test("telegram")} disabled={busy !== null || !initial.telegram.configured}>
            {busy === "test-telegram" ? <Spinner /> : <SendIcon />} Send test
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5">
          <div className="flex gap-3">
            <WebhookIcon className="mt-0.5 size-4 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-medium">One-tap actions from Telegram</p>
              <p className="text-muted-foreground">
                Accept/Decline and “Mark paid” buttons + /pending, /today, /stats commands. Secured with a secret token.
                {!appUrlIsHttps && " Requires a public HTTPS APP_URL."}
              </p>
            </div>
          </div>
          <Switch
            checked={initial.telegram.webhookEnabled}
            disabled={busy !== null || !initial.telegram.configured || !appUrlIsHttps}
            onCheckedChange={(on) =>
              call("webhook", () => api("/api/admin/integrations/telegram", { body: { action: on ? "enable_webhook" : "disable_webhook" } }), on ? "Telegram actions enabled" : "Telegram actions disabled")
            }
          />
        </div>
      </Card>

      <Card
        icon={<WhatsAppIcon className="size-5 text-[#25D366]" />}
        title="WhatsApp"
        description="Alerts to you and ride updates to customers."
        status={<StatusPill ok={initial.whatsapp.configured} source={initial.whatsapp.source} />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Provider">
            <Select value={wa.provider} onValueChange={(x) => setWa({ ...wa, provider: x as typeof wa.provider })}>
              <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Disabled</SelectItem>
                <SelectItem value="meta">WhatsApp Cloud API (Meta) — official</SelectItem>
                <SelectItem value="twilio">Twilio WhatsApp</SelectItem>
                <SelectItem value="callmebot">CallMeBot — free, alerts to you only</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Your WhatsApp number" hint="Where alerts are sent, with country code">
            <TextInput value={wa.adminNumber} onChange={(x) => setWa({ ...wa, adminNumber: x.replace(/[^\d+]/g, "") })} placeholder="+919876543210" />
          </FormField>
        </div>
        {wa.provider === "meta" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Access token (permanent system-user token)"><SecretInput hint={initial.whatsapp.metaTokenHint} value={waSecrets.metaToken} onChange={(x) => setWaSecrets({ ...waSecrets, metaToken: x })} /></FormField>
            <FormField label="Phone number ID"><TextInput value={wa.metaPhoneNumberId} onChange={(x) => setWa({ ...wa, metaPhoneNumberId: x.replace(/\D/g, "") })} /></FormField>
            <FormField label="Template name (recommended)" hint="Approved UTILITY template with one body variable {{1}}">
              <TextInput value={wa.metaTemplate} onChange={(x) => setWa({ ...wa, metaTemplate: x.toLowerCase().replace(/[^a-z0-9_]/g, "") })} placeholder="ride_update" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Language"><TextInput value={wa.metaTemplateLang} onChange={(x) => setWa({ ...wa, metaTemplateLang: x })} /></FormField>
              <FormField label="API version"><TextInput value={wa.metaApiVersion} onChange={(x) => setWa({ ...wa, metaApiVersion: x })} /></FormField>
            </div>
          </div>
        )}
        {wa.provider === "twilio" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Account SID"><TextInput value={wa.twilioSid} onChange={(x) => setWa({ ...wa, twilioSid: x.trim() })} placeholder="AC…" /></FormField>
            <FormField label="Auth token"><SecretInput hint={initial.whatsapp.twilioTokenHint} value={waSecrets.twilioToken} onChange={(x) => setWaSecrets({ ...waSecrets, twilioToken: x })} /></FormField>
            <FormField label="WhatsApp sender"><TextInput value={wa.twilioFrom} onChange={(x) => setWa({ ...wa, twilioFrom: x.trim() })} placeholder="+14155238886" /></FormField>
          </div>
        )}
        {wa.provider === "callmebot" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Send “I allow callmebot to send me messages” to CallMeBot on WhatsApp to get your free API key. Only your own number can receive messages.</p>
            <FormField label="CallMeBot API key"><SecretInput hint={initial.whatsapp.callmebotKeyHint} value={waSecrets.callmebotApiKey} onChange={(x) => setWaSecrets({ ...waSecrets, callmebotApiKey: x })} /></FormField>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save("wa", { whatsapp: { ...wa, ...waSecrets } })} disabled={busy !== null}>
            {busy === "wa" && <Spinner />} Save
          </Button>
          <Button variant="outline" onClick={() => test("whatsapp")} disabled={busy !== null || !initial.whatsapp.configured}>
            {busy === "test-whatsapp" ? <Spinner /> : <SendIcon />} Send test to me
          </Button>
        </div>
      </Card>

      <Card
        icon={<MailIcon className="size-5 text-primary" />}
        title="Email (SMTP)"
        description="Required in production: customer verification codes, confirmations and receipts."
        status={<StatusPill ok={initial.smtp.configured} source={initial.smtp.source} />}
      >
        <p className="text-sm text-muted-foreground">
          Gmail: host <code>smtp.gmail.com</code>, port <code>465</code>, SSL on, your Gmail address and a 16-character{" "}
          <span className="font-medium text-foreground">App Password</span> (Google Account → Security → App passwords).
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="SMTP host" className="sm:col-span-2"><TextInput value={smtp.host} onChange={(x) => setSmtp({ ...smtp, host: x.trim() })} placeholder="smtp.gmail.com" /></FormField>
          <FormField label="Port"><TextInput value={String(smtp.port)} onChange={(x) => setSmtp({ ...smtp, port: Number(x.replace(/\D/g, "")) || 0 })} inputMode="numeric" /></FormField>
          <FormField label="Username"><TextInput value={smtp.user} onChange={(x) => setSmtp({ ...smtp, user: x.trim() })} autoComplete="off" /></FormField>
          <FormField label="Password / app password"><SecretInput hint={initial.smtp.passHint} value={smtpPass} onChange={setSmtpPass} /></FormField>
          <FormField label="From address"><TextInput value={smtp.from} onChange={(x) => setSmtp({ ...smtp, from: x })} placeholder="Saarathi Cabs <you@gmail.com>" /></FormField>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={smtp.secure} onCheckedChange={(x) => setSmtp({ ...smtp, secure: x, port: x && smtp.port === 587 ? 465 : !x && smtp.port === 465 ? 587 : smtp.port })} />
          Use SSL/TLS (port 465). Off = STARTTLS (port 587, TLS still required).
        </label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save("smtp", { smtp: { ...smtp, pass: smtpPass } })} disabled={busy !== null}>
            {busy === "smtp" && <Spinner />} Save
          </Button>
          <Button variant="outline" onClick={() => test("email")} disabled={busy !== null || !initial.smtp.configured}>
            {busy === "test-email" ? <Spinner /> : <SendIcon />} Send test email
          </Button>
        </div>
      </Card>
    </div>
  );
}
