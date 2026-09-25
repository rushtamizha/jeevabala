"use client";

import { CalendarOffIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api, errorMessage } from "@/lib/api-client";
import { FormField, TextInput } from "./form-kit";

export function BlackoutManager({ items }: { items: { id: string; startsWall: string; endsWall: string; reason: string | null }[] }) {
  const router = useRouter();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const fmt = (w: string) => new Date(`${w}:00`).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.2fr_auto] sm:items-end">
        <FormField label="From"><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></FormField>
        <FormField label="Until"><Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></FormField>
        <FormField label="Reason (private)"><TextInput value={reason} onChange={setReason} maxLength={120} placeholder="Family function, vehicle service…" /></FormField>
        <Button
          disabled={busy || !start || !end}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/api/admin/blackouts", { body: { startsAt: start.slice(0, 16), endsAt: end.slice(0, 16), reason: reason || undefined } });
              toast.success("Time blocked — customers can’t book it");
              setStart("");
              setEnd("");
              setReason("");
              router.refresh();
            } catch (err) {
              toast.error(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Spinner /> : <CalendarOffIcon />} Block time
        </Button>
      </div>
      <ul className="space-y-2">
        {items.length === 0 && <li className="text-sm text-muted-foreground">No time off scheduled.</li>}
        {items.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-3 text-sm">
            <span>
              <span className="font-medium">{fmt(b.startsWall)} → {fmt(b.endsWall)}</span>
              {b.reason && <span className="block text-xs text-muted-foreground">{b.reason}</span>}
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Remove"
              onClick={async () => {
                try {
                  await api(`/api/admin/blackouts/${b.id}`, { method: "DELETE" });
                  router.refresh();
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            >
              <Trash2Icon />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
