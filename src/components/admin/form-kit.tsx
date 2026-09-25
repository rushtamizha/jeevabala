"use client";

import { cn } from "cn";
import { SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError, api, errorMessage } from "@/lib/api-client";

export function FormField({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TextInput({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  return <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-lg" {...rest} />;
}

export function TextArea({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void } & Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange">) {
  return <Textarea value={value} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

/** Numeric input that tolerates intermediate text ("", "1.") while editing. */
export function NumberInput({ value, onChange, step, min, max, suffix, decimals = 0 }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string; decimals?: number }) {
  const [text, setText] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (Number(text) !== value) setText(String(value));
  }
  return (
    <div className="relative">
      <Input
        inputMode={decimals ? "decimal" : "numeric"}
        value={text}
        step={step}
        onChange={(e) => {
          const t = e.target.value.replace(decimals ? /[^\d.]/g : /\D/g, "");
          setText(t);
          const n = Number(t);
          if (t !== "" && Number.isFinite(n)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
        }}
        onBlur={() => setText(String(value))}
        className={cn("h-10 rounded-lg tabular", suffix && "pr-14")}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

/** Rupee input backed by integer paise. */
export function MoneyInput({ value, onChange, suffix }: { value: number; onChange: (paise: number) => void; suffix?: string }) {
  const [text, setText] = useState(String(value / 100));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (Math.round(Number(text) * 100) !== value) setText(String(value / 100));
  }
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
      <Input
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.]/g, "");
          setText(t);
          const n = Number(t);
          if (t !== "" && Number.isFinite(n)) onChange(Math.round(n * 100));
        }}
        onBlur={() => setText(String(value / 100))}
        className={cn("h-10 rounded-lg pl-7 tabular", suffix && "pr-14")}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

export function SwitchRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-3.5">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function Panel({ title, description, children, actions }: { title: string; description?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-[15px] font-bold">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

/** Holds a settings section, tracks dirty state and saves via the settings API. */
export function useSettingsForm<T>(section: string, initial: T) {
  const router = useRouter();
  const [value, setValue] = useState<T>(initial);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(value) !== JSON.stringify(initial);
  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      await api(`/api/admin/settings/${section}`, { method: "PUT", body: { value } });
      toast.success("Settings saved");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) setErrors(err.fields);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const set = <K extends keyof T>(key: K, v: T[K]) => setValue((prev) => ({ ...prev, [key]: v }));
  return { value, setValue, set, save, saving, dirty, errors, reset: () => setValue(initial) };
}

export function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  return (
    <div
      className={cn(
        "sticky bottom-20 z-20 flex items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 shadow-premium backdrop-blur transition-all md:bottom-4",
        dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <p className="pl-2 text-sm text-muted-foreground">You have unsaved changes</p>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onReset} disabled={saving}>
          Discard
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Spinner /> : <SaveIcon />} Save changes
        </Button>
      </div>
    </div>
  );
}
