"use client";

import { PencilIcon, PlusIcon, TicketPercentIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { formatINR } from "@/lib/format";
import { FormField, MoneyInput, NumberInput, SwitchRow, TextInput } from "./form-kit";

type Promo = {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENT" | "FLAT";
  value: number;
  maxDiscount: number | null;
  minFare: number | null;
  usageLimit: number | null;
  perCustomerLimit: number;
  firstRideOnly: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  used: number;
};

type Draft = Omit<Promo, "id" | "used"> & { id?: string };

const EMPTY: Draft = { code: "", description: "", discountType: "PERCENT", value: 10, maxDiscount: 20000, minFare: null, usageLimit: null, perCustomerLimit: 1, firstRideOnly: false, startsAt: null, expiresAt: null, isActive: true };

const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

export function PromoManager({ promos }: { promos: Promo[] }) {
  const router = useRouter();
  const [d, setD] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = async () => {
    if (!d) return;
    setBusy(true);
    setErrors({});
    const { id, ...body } = d;
    try {
      await api(id ? `/api/admin/promos/${id}` : "/api/admin/promos", {
        method: id ? "PATCH" : "POST",
        body: { ...body, description: body.description || undefined, value: body.discountType === "PERCENT" ? Math.round(body.value) : body.value },
      });
      toast.success(id ? "Promo updated" : "Promo created");
      setD(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) setErrors(err.fields);
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setD({ ...EMPTY })}>
          <PlusIcon /> New promo code
        </Button>
      </div>
      {promos.length === 0 && <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">No promo codes yet. Create one for festivals, first rides or loyal customers.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {promos.map((p) => (
          <article key={p.id} className="flex overflow-hidden rounded-2xl border bg-card">
            <div className="grid w-20 shrink-0 place-items-center bg-primary text-primary-foreground">
              <span className="-rotate-90 whitespace-nowrap text-sm font-bold tracking-wide">{p.discountType === "PERCENT" ? `${p.value}% OFF` : `${formatINR(p.value)} OFF`}</span>
            </div>
            <div className="min-w-0 flex-1 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-lg font-semibold">{p.code}</p>
                  <p className="text-xs text-muted-foreground">{p.description || "—"}</p>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setD({ ...p })}>
                  <PencilIcon />
                </Button>
              </div>
              <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">
                Used {p.used}{p.usageLimit ? `/${p.usageLimit}` : ""} · {p.firstRideOnly ? "First ride only · " : ""}
                {p.expiresAt ? `Ends ${new Date(p.expiresAt).toLocaleDateString("en-IN")}` : "No expiry"} ·{" "}
                <span className={p.isActive ? "font-medium text-success" : "text-muted-foreground"}>{p.isActive ? "Active" : "Inactive"}</span>
              </p>
            </div>
          </article>
        ))}
      </div>
      <Dialog open={d !== null} onOpenChange={(o) => !o && setD(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><TicketPercentIcon className="size-5 text-primary" /> {d?.id ? "Edit promo" : "New promo"}</DialogTitle>
          </DialogHeader>
          {d && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Code" error={errors.code}><TextInput value={d.code} onChange={(x) => setD({ ...d, code: x.toUpperCase().replace(/[^A-Z0-9-]/g, "") })} maxLength={24} placeholder="DIWALI10" /></FormField>
              <FormField label="Type">
                <Select value={d.discountType} onValueChange={(x) => setD({ ...d, discountType: x as Draft["discountType"], value: x === "PERCENT" ? 10 : 10000 })}>
                  <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Percentage</SelectItem>
                    <SelectItem value="FLAT">Flat amount</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Description" className="sm:col-span-2"><TextInput value={d.description ?? ""} onChange={(x) => setD({ ...d, description: x })} maxLength={120} placeholder="Festive offer on outstation rides" /></FormField>
              <FormField label={d.discountType === "PERCENT" ? "Discount %" : "Discount"} error={errors.value}>
                {d.discountType === "PERCENT" ? <NumberInput value={d.value} onChange={(x) => setD({ ...d, value: x })} min={1} max={100} suffix="%" /> : <MoneyInput value={d.value} onChange={(x) => setD({ ...d, value: x })} />}
              </FormField>
              {d.discountType === "PERCENT" && <FormField label="Max discount"><MoneyInput value={d.maxDiscount ?? 0} onChange={(x) => setD({ ...d, maxDiscount: x || null })} /></FormField>}
              <FormField label="Minimum fare"><MoneyInput value={d.minFare ?? 0} onChange={(x) => setD({ ...d, minFare: x || null })} /></FormField>
              <FormField label="Total uses (0 = unlimited)"><NumberInput value={d.usageLimit ?? 0} onChange={(x) => setD({ ...d, usageLimit: x || null })} min={0} max={1000000} /></FormField>
              <FormField label="Uses per customer"><NumberInput value={d.perCustomerLimit} onChange={(x) => setD({ ...d, perCustomerLimit: Math.max(1, x) })} min={1} max={100} /></FormField>
              <FormField label="Starts"><Input type="datetime-local" value={toLocal(d.startsAt)} onChange={(e) => setD({ ...d, startsAt: fromLocal(e.target.value) })} /></FormField>
              <FormField label="Expires"><Input type="datetime-local" value={toLocal(d.expiresAt)} onChange={(e) => setD({ ...d, expiresAt: fromLocal(e.target.value) })} /></FormField>
              <div className="space-y-2 sm:col-span-2">
                <SwitchRow label="First ride only" checked={d.firstRideOnly} onChange={(x) => setD({ ...d, firstRideOnly: x })} />
                <SwitchRow label="Active" checked={d.isActive} onChange={(x) => setD({ ...d, isActive: x })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setD(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy && <Spinner />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
