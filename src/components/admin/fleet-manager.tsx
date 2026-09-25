"use client";

import { cn } from "cn";
import { ExternalLinkIcon, LuggageIcon, PencilIcon, PlusIcon, SnowflakeIcon, Trash2Icon, UsersIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { VehicleArt } from "@/components/site/vehicle-art";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { formatINR, formatRate } from "@/lib/format";
import type { PricingSettings } from "@/lib/settings-schema";
import { VEHICLE_CATEGORIES, VEHICLE_CATEGORY_LABEL, type VehicleCategory, type VehicleRates } from "@/lib/types";
import { pricingForVehicle } from "@/lib/vehicle-pricing";
import { FormField, NumberInput, SwitchRow, TextArea, TextInput } from "./form-kit";
import { ImageUpload } from "./image-upload";

type Vehicle = {
  id?: string;
  slug: string | null;
  category: string;
  name: string;
  model: string | null;
  description: string | null;
  seats: number;
  luggage: number;
  plateNumber: string | null;
  color: string | null;
  features: string[];
  hasAc: boolean;
  priceMultiplier: number;
  rates: VehicleRates;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
};

const EMPTY: Vehicle = { slug: "", category: "SEDAN", name: "", model: "", description: "", seats: 4, luggage: 2, plateNumber: "", color: "", features: [], hasAc: true, priceMultiplier: 100, rates: {}, imageUrl: "", isActive: true, sortOrder: 0 };

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** Optional rupee field backed by paise; blank = inherit. Placeholder shows the inherited value. */
function RateInput({ value, onChange, inherited, suffix }: { value: number | null | undefined; onChange: (paise: number | null) => void; inherited: number; suffix?: string }) {
  const [text, setText] = useState(value ? String(value / 100) : "");
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(value ? String(value / 100) : "");
  }
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
      <Input
        inputMode="decimal"
        value={text}
        placeholder={String(inherited / 100)}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.]/g, "");
          setText(t);
          const n = Number(t);
          onChange(t === "" || !Number.isFinite(n) || n <= 0 ? null : Math.round(n * 100));
        }}
        className={cn("h-10 pl-7 tabular placeholder:text-muted-foreground/60", suffix && "pr-12")}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

export function FleetManager({ vehicles, pricing }: { vehicles: Vehicle[]; pricing: PricingSettings }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const patch = (p: Partial<Vehicle>) => setEditing((e) => (e ? { ...e, ...p } : e));
  const setRate = (k: keyof VehicleRates, v: number | null) => setEditing((e) => (e ? { ...e, rates: { ...e.rates, [k]: v } } : e));

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setErrors({});
    const { id, ...rest } = editing;
    const rates = Object.fromEntries(Object.entries(rest.rates).filter(([, x]) => typeof x === "number" && x > 0));
    const body = { ...rest, rates, slug: rest.slug || undefined, model: rest.model || undefined, description: rest.description || undefined, plateNumber: rest.plateNumber || undefined, color: rest.color || undefined, imageUrl: rest.imageUrl || "" };
    try {
      await api(id ? `/api/admin/vehicles/${id}` : "/api/admin/vehicles", { method: id ? "PATCH" : "POST", body });
      toast.success(id ? "Vehicle updated" : "Vehicle added");
      setEditing(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) setErrors(err.fields);
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // Inherited values = standard pricing × multiplier, ignoring this vehicle's overrides.
  const base = editing ? pricingForVehicle(pricing, { priceMultiplier: editing.priceMultiplier, rates: {} }) : null;
  const eff = editing ? pricingForVehicle(pricing, editing) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{vehicles.filter((v) => v.isActive).length} of {vehicles.length} vehicles live</p>
        <Button onClick={() => { setSlugTouched(false); setErrors({}); setEditing({ ...EMPTY, sortOrder: vehicles.length }); }}>
          <PlusIcon /> Add vehicle
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {vehicles.map((v) => {
          const p = pricingForVehicle(pricing, v);
          return (
            <article key={v.id} className="flex flex-col rounded-xl border bg-card p-3">
              <div className="relative aspect-[16/9] overflow-hidden rounded-md bg-secondary">
                {v.imageUrl ? (
                  <Image src={v.imageUrl} alt={v.name} fill sizes="360px" className="object-cover" unoptimized={v.imageUrl.startsWith("https://")} />
                ) : (
                  <div className="absolute inset-0 grid place-items-center p-6"><VehicleArt category={v.category} className="max-h-full" /></div>
                )}
                <span className="absolute left-2.5 top-2.5 rounded-full bg-success px-2.5 py-1 text-[10px] font-medium text-white">{VEHICLE_CATEGORY_LABEL[v.category as VehicleCategory] ?? v.category}</span>
                {!v.isActive && <span className="absolute right-2.5 top-2.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-medium text-white">Hidden</span>}
              </div>
              <div className="flex items-start justify-between gap-2 px-1 pt-3">
                <div className="min-w-0">
                  <h3 className="truncate font-bold">{v.name}</h3>
                  <p className="truncate text-xs text-muted-foreground">{[v.model, v.color, v.plateNumber].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  {v.slug && (
                    <Button asChild size="icon-sm" variant="ghost" aria-label="View on site">
                      <a href={`/vehicles#${v.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon /></a>
                    </Button>
                  )}
                  <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => { setSlugTouched(true); setErrors({}); setEditing({ ...v, rates: v.rates ?? {} }); }}>
                    <PencilIcon />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete"
                    className="text-destructive hover:text-destructive"
                    onClick={async () => {
                      if (!confirm(`Delete ${v.name}? Existing bookings keep their details.`)) return;
                      try {
                        await api(`/api/admin/vehicles/${v.id}`, { method: "DELETE" });
                        toast.success("Vehicle deleted");
                        router.refresh();
                      } catch (err) {
                        toast.error(errorMessage(err));
                      }
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
              <p className="flex flex-wrap items-center gap-x-1.5 px-1 pt-1.5 text-xs text-muted-foreground">
                <UsersIcon className="size-3.5" /> {v.seats} • <LuggageIcon className="size-3.5" /> {v.luggage} • <SnowflakeIcon className="size-3.5" /> {v.hasAc ? "AC / Non-AC" : "Non-AC"}
              </p>
              <dl className="mx-1 mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-xs">
                <div><dt className="text-muted-foreground">One way</dt><dd className="font-bold tabular">{formatRate(p.oneWay.acPerKm)}/km</dd></div>
                <div><dt className="text-muted-foreground">Round trip</dt><dd className="font-bold tabular">{formatRate(p.roundTrip.acPerKm)}/km</dd></div>
                <div><dt className="text-muted-foreground">Bata</dt><dd className="font-bold tabular">{formatINR(p.oneWay.driverBata)}</dd></div>
              </dl>
            </article>
          );
        })}
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? `Edit ${editing.name}` : "Add vehicle"}</DialogTitle>
            <DialogDescription>Leave any fare blank to use your standard pricing × the multiplier (shown in grey).</DialogDescription>
          </DialogHeader>
          {editing && base && eff && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Name" hint="e.g. Sedan, Innova Crysta" error={errors.name}>
                <TextInput value={editing.name} maxLength={40} onChange={(x) => patch({ name: x, ...(slugTouched ? {} : { slug: slugify(x) }) })} />
              </FormField>
              <FormField label="Category" error={errors.category}>
                <Select value={editing.category} onValueChange={(x) => patch({ category: x })}>
                  <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VEHICLE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{VEHICLE_CATEGORY_LABEL[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="URL slug" hint={`Used in links like /book?vehicle=${editing.slug || "sedan"}`} error={errors.slug}>
                <TextInput value={editing.slug ?? ""} maxLength={40} onChange={(x) => { setSlugTouched(true); patch({ slug: slugify(x) }); }} />
              </FormField>
              <FormField label="Models" error={errors.model}><TextInput value={editing.model ?? ""} maxLength={60} placeholder="Swift Dzire / Toyota Etios" onChange={(x) => patch({ model: x })} /></FormField>
              <FormField label="Short description" className="sm:col-span-2" error={errors.description}><TextArea value={editing.description ?? ""} rows={2} maxLength={300} onChange={(x) => patch({ description: x })} /></FormField>
              <FormField label="Photo" className="sm:col-span-2"><ImageUpload value={editing.imageUrl} alt={editing.name} onChange={(x) => patch({ imageUrl: x })} hint="Landscape photo on a clean background. Without one, an illustration is shown." /></FormField>
              <FormField label="Seats (passengers)" error={errors.seats}><NumberInput value={editing.seats} min={1} max={60} onChange={(x) => patch({ seats: x })} /></FormField>
              <FormField label="Luggage bags" error={errors.luggage}><NumberInput value={editing.luggage} min={0} max={40} onChange={(x) => patch({ luggage: x })} /></FormField>
              <FormField label="Plate number" hint="Shown to customers after confirmation" error={errors.plateNumber}><TextInput value={editing.plateNumber ?? ""} maxLength={16} placeholder="TN 01 AB 1234" onChange={(x) => patch({ plateNumber: x.toUpperCase() })} /></FormField>
              <FormField label="Colour" error={errors.color}><TextInput value={editing.color ?? ""} maxLength={24} placeholder="White" onChange={(x) => patch({ color: x })} /></FormField>
              <FormField label="Features (comma separated)" className="sm:col-span-2">
                <TextInput value={editing.features.join(", ")} onChange={(x) => patch({ features: x.split(",").map((f) => f.trim()).filter((f) => f.length >= 2).slice(0, 10) })} />
              </FormField>

              <div className="rounded-xl border p-4 sm:col-span-2">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="font-bold">Fares</h3>
                    <p className="text-xs text-muted-foreground">Effective one-way AC rate: <b className="text-foreground">{formatRate(eff.oneWay.acPerKm)}/km</b></p>
                  </div>
                  <div className="w-40">
                    <FormField label="Multiplier" hint="For blank fields"><NumberInput value={editing.priceMultiplier} min={50} max={500} suffix="%" onChange={(x) => patch({ priceMultiplier: x })} /></FormField>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField label="One way · AC"><RateInput value={editing.rates.oneWayAcPerKm} inherited={base.oneWay.acPerKm} suffix="/km" onChange={(x) => setRate("oneWayAcPerKm", x)} /></FormField>
                  <FormField label="One way · Non-AC"><RateInput value={editing.rates.oneWayNonAcPerKm} inherited={base.oneWay.nonAcPerKm} suffix="/km" onChange={(x) => setRate("oneWayNonAcPerKm", x)} /></FormField>
                  <FormField label="Driver bata"><RateInput value={editing.rates.driverBataPerDay} inherited={base.oneWay.driverBata} suffix="/day" onChange={(x) => setRate("driverBataPerDay", x)} /></FormField>
                  <FormField label="Round trip · AC"><RateInput value={editing.rates.roundTripAcPerKm} inherited={base.roundTrip.acPerKm} suffix="/km" onChange={(x) => setRate("roundTripAcPerKm", x)} /></FormField>
                  <FormField label="Round trip · Non-AC"><RateInput value={editing.rates.roundTripNonAcPerKm} inherited={base.roundTrip.nonAcPerKm} suffix="/km" onChange={(x) => setRate("roundTripNonAcPerKm", x)} /></FormField>
                  <FormField label="Local packages" hint="% of standard package price">
                    <NumberInput value={editing.rates.localMultiplierPct ?? editing.priceMultiplier} min={50} max={500} suffix="%" onChange={(x) => setRate("localMultiplierPct", x === editing.priceMultiplier ? null : x)} />
                  </FormField>
                  <FormField label="Airport base · AC"><RateInput value={editing.rates.airportAcBase} inherited={base.airport.acBaseFare} onChange={(x) => setRate("airportAcBase", x)} /></FormField>
                  <FormField label="Airport base · Non-AC"><RateInput value={editing.rates.airportNonAcBase} inherited={base.airport.nonAcBaseFare} onChange={(x) => setRate("airportNonAcBase", x)} /></FormField>
                  <FormField label="Airport extra · AC"><RateInput value={editing.rates.airportAcPerKm} inherited={base.airport.acPerKm} suffix="/km" onChange={(x) => setRate("airportAcPerKm", x)} /></FormField>
                </div>
              </div>

              <FormField label="Display order" hint="Lower shows first"><NumberInput value={editing.sortOrder} min={0} max={100} onChange={(x) => patch({ sortOrder: x })} /></FormField>
              <div className="space-y-2 sm:col-span-2">
                <SwitchRow label="AC available" description="Turn off for non-AC-only vehicles" checked={editing.hasAc} onChange={(x) => patch({ hasAc: x })} />
                <SwitchRow label="Visible to customers" checked={editing.isActive} onChange={(x) => patch({ isActive: x })} />
              </div>
            </div>
          )}
          <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t bg-card px-6 py-4">
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy && <Spinner />} Save vehicle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
