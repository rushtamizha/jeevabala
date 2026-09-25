"use client";

import { cn } from "cn";
import { ExternalLinkIcon, MapPinIcon, PencilIcon, PlaneIcon, PlusIcon, RouteIcon, SearchIcon, StarIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { initials } from "@/lib/format";
import { FormField, NumberInput, SwitchRow, TextArea, TextInput } from "./form-kit";
import { ImageUpload, LinesInput } from "./image-upload";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/* ------------------------------------------------------------ shared bits */

function useEditor<T extends { id?: string }>(endpoint: string, noun: string) {
  const router = useRouter();
  const [editing, setEditing] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const open = (v: T) => {
    setErrors({});
    setEditing(v);
  };
  const save = async (toBody: (v: T) => unknown) => {
    if (!editing) return;
    setBusy(true);
    setErrors({});
    try {
      await api(editing.id ? `${endpoint}/${editing.id}` : endpoint, { method: editing.id ? "PATCH" : "POST", body: toBody(editing) });
      toast.success(editing.id ? `${noun} updated` : `${noun} added`);
      setEditing(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) setErrors(err.fields);
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string, label: string) => {
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    try {
      await api(`${endpoint}/${id}`, { method: "DELETE" });
      toast.success(`${noun} deleted`);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const patch = (p: Partial<T>) => setEditing((e) => (e ? { ...e, ...p } : e));
  return { editing, open, close: () => setEditing(null), save, remove, patch, busy, errors };
}

function Toolbar({ query, onQuery, placeholder, onAdd, addLabel, count }: { query: string; onQuery: (q: string) => void; placeholder: string; onAdd: () => void; addLabel: string; count: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-56 flex-1">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} className="h-10 pl-10" aria-label={placeholder} />
      </div>
      <span className="text-sm text-muted-foreground">{count} total</span>
      <Button onClick={onAdd}>
        <PlusIcon /> {addLabel}
      </Button>
    </div>
  );
}

function StatusDots({ active, featured }: { active: boolean; featured?: boolean }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <span className={cn("inline-flex h-5 items-center rounded-full border px-2 text-[10.5px] font-medium", active ? "border-success bg-success/8 text-success" : "border-[#bdbdbd] text-muted-foreground")}>
        {active ? "Live" : "Hidden"}
      </span>
      {featured && <span className="inline-flex h-5 items-center rounded-full border border-primary bg-accent px-2 text-[10.5px] font-medium text-primary">Featured</span>}
    </span>
  );
}

function RowActions({ onEdit, onDelete, href }: { onEdit: () => void; onDelete: () => void; href?: string }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {href && (
        <Button asChild size="icon-sm" variant="ghost" aria-label="View on site">
          <a href={href} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon />
          </a>
        </Button>
      )}
      <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={onEdit}>
        <PencilIcon />
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Delete" className="text-destructive hover:text-destructive" onClick={onDelete}>
        <Trash2Icon />
      </Button>
    </div>
  );
}

/** Google-style result preview with length guidance (≤60 title, ≤155 description). */
function SerpPreview({ title, description, path }: { title: string; description: string; path: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Search preview</p>
      <p className="mt-2 truncate text-xs text-muted-foreground">yourdomain.com{path}</p>
      <p className="mt-0.5 line-clamp-1 text-[17px] leading-snug text-[#1a0dab]">{title || "Page title"}</p>
      <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-[#4d5156]">{description || "Meta description shown under the title in search results."}</p>
      <p className="mt-2 flex gap-4 text-[11px]">
        <span className={title.length > 60 ? "text-destructive" : "text-muted-foreground"}>Title {title.length}/60</span>
        <span className={description.length > 155 ? "text-destructive" : "text-muted-foreground"}>Description {description.length}/155</span>
      </p>
    </div>
  );
}

function EditorDialog({ open, onClose, title, description, busy, onSave, saveLabel, children, wide }: { open: boolean; onClose: () => void; title: string; description?: string; busy: boolean; onSave: () => void; saveLabel: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn("max-h-[92svh] overflow-y-auto", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t bg-card px-6 py-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={busy}>{busy && <Spinner />} {saveLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ Cities */

export type AdminCity = {
  id?: string;
  slug: string;
  name: string;
  district: string | null;
  state: string;
  lat: number;
  lng: number;
  intro: string | null;
  highlights: string[];
  attractions: string[];
  airportName: string | null;
  imageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
};

const EMPTY_CITY: AdminCity = { slug: "", name: "", district: "", state: "Tamil Nadu", lat: 11.1, lng: 78.6, intro: "", highlights: [], attractions: [], airportName: "", imageUrl: "", metaTitle: "", metaDescription: "", isActive: true, isFeatured: false, sortOrder: 100 };

export function CityManager({ cities }: { cities: AdminCity[] }) {
  const ed = useEditor<AdminCity>("/api/admin/cities", "City");
  const [q, setQ] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const list = useMemo(() => cities.filter((c) => `${c.name} ${c.district ?? ""} ${c.state}`.toLowerCase().includes(q.trim().toLowerCase())), [cities, q]);
  const e = ed.editing;
  const err = ed.errors;
  return (
    <div className="space-y-4">
      <Toolbar query={q} onQuery={setQ} placeholder="Search cities" count={cities.length} addLabel="Add city" onAdd={() => { setSlugTouched(false); ed.open({ ...EMPTY_CITY }); }} />
      <div className="overflow-hidden rounded-xl border bg-card">
        <ul className="divide-y">
          {list.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-primary">
                {c.imageUrl ? <Image src={c.imageUrl} alt="" fill sizes="44px" className="object-cover" unoptimized={c.imageUrl.startsWith("https://")} /> : c.airportName ? <PlaneIcon className="size-4" /> : <MapPinIcon className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.name} <span className="font-normal text-muted-foreground">· {c.district && c.district !== c.name ? `${c.district}, ` : ""}{c.state}</span></p>
                <p className="truncate text-xs text-muted-foreground">/{c.slug}-taxi</p>
              </div>
              <StatusDots active={c.isActive} featured={c.isFeatured} />
              <RowActions href={`/${c.slug}-taxi`} onEdit={() => { setSlugTouched(true); ed.open(c); }} onDelete={() => c.id && ed.remove(c.id, c.name)} />
            </li>
          ))}
          {list.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">No cities match “{q}”.</li>}
        </ul>
      </div>

      <EditorDialog
        open={e !== null}
        onClose={ed.close}
        wide
        title={e?.id ? `Edit ${e.name}` : "Add city"}
        description="Each city gets its own SEO landing page at /{slug}-taxi."
        busy={ed.busy}
        saveLabel="Save city"
        onSave={() => ed.save(({ id: _id, ...rest }) => rest)}
      >
        {e && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="City name" error={err.name}>
              <TextInput value={e.name} maxLength={60} placeholder="Coimbatore" onChange={(x) => ed.patch({ name: x, ...(slugTouched ? {} : { slug: slugify(x) }) })} />
            </FormField>
            <FormField label="URL slug" hint={`Page: /${e.slug || "city"}-taxi`} error={err.slug}>
              <TextInput value={e.slug} maxLength={60} onChange={(x) => { setSlugTouched(true); ed.patch({ slug: slugify(x) }); }} />
            </FormField>
            <FormField label="District" error={err.district}><TextInput value={e.district ?? ""} maxLength={60} onChange={(x) => ed.patch({ district: x })} /></FormField>
            <FormField label="State" error={err.state}><TextInput value={e.state} maxLength={60} onChange={(x) => ed.patch({ state: x })} /></FormField>
            <FormField label="Latitude" hint="Used for nearby cities and fares" error={err.lat}><NumberInput value={e.lat} decimals={5} min={-90} max={90} onChange={(x) => ed.patch({ lat: x })} /></FormField>
            <FormField label="Longitude" error={err.lng}><NumberInput value={e.lng} decimals={5} min={-180} max={180} onChange={(x) => ed.patch({ lng: x })} /></FormField>
            <FormField label="Airport (optional)" className="sm:col-span-2" error={err.airportName}><TextInput value={e.airportName ?? ""} maxLength={100} placeholder="Coimbatore International Airport (CJB)" onChange={(x) => ed.patch({ airportName: x })} /></FormField>
            <FormField label="Intro paragraph" hint="Leave blank to use a well-written default." className="sm:col-span-2" error={err.intro}><TextArea value={e.intro ?? ""} rows={4} maxLength={1500} onChange={(x) => ed.patch({ intro: x })} /></FormField>
            <FormField label="Highlights (one per line)" error={err.highlights}><LinesInput value={e.highlights} max={10} onChange={(x) => ed.patch({ highlights: x })} placeholder={"Airport pickups 24×7\nHill-station specialists"} /></FormField>
            <FormField label="Places to visit (one per line)" error={err.attractions}><LinesInput value={e.attractions} max={12} onChange={(x) => ed.patch({ attractions: x })} placeholder={"Marudhamalai Temple\nIsha Yoga Centre"} /></FormField>
            <FormField label="Hero image" className="sm:col-span-2"><ImageUpload value={e.imageUrl} alt={`${e.name} taxi`} onChange={(x) => ed.patch({ imageUrl: x })} /></FormField>
            <FormField label="SEO title (optional)" error={err.metaTitle}><TextInput value={e.metaTitle ?? ""} maxLength={70} placeholder={`${e.name || "City"} Taxi Service – One Way & Airport Cabs`} onChange={(x) => ed.patch({ metaTitle: x })} /></FormField>
            <FormField label="SEO description (optional)" error={err.metaDescription}><TextArea value={e.metaDescription ?? ""} rows={2} maxLength={170} onChange={(x) => ed.patch({ metaDescription: x })} /></FormField>
            <div className="sm:col-span-2">
              <SerpPreview
                title={e.metaTitle || `${e.name || "City"} Taxi Service – One Way & Airport Cabs`}
                description={e.metaDescription || `Book a taxi in ${e.name || "your city"}. One-way drop, round trip, airport & local cabs with a verified driver. No surge, pay after the ride.`}
                path={`/${e.slug || "city"}-taxi`}
              />
            </div>
            <FormField label="Display order" hint="Lower shows first"><NumberInput value={e.sortOrder} min={0} max={1000} onChange={(x) => ed.patch({ sortOrder: x })} /></FormField>
            <div className="space-y-2 sm:col-span-2">
              <SwitchRow label="Published" description="Show the page, list it in menus and the sitemap" checked={e.isActive} onChange={(x) => ed.patch({ isActive: x })} />
              <SwitchRow label="Featured" description="Appears in ‘Popular cities’ and first in lists" checked={e.isFeatured} onChange={(x) => ed.patch({ isFeatured: x })} />
            </div>
          </div>
        )}
      </EditorDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ Routes */

export type AdminRoute = {
  id?: string;
  slug: string;
  fromName: string;
  toName: string;
  fromCityId: string | null;
  toCityId: string | null;
  distanceKm: number;
  durationMin: number;
  description: string | null;
  highlights: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
};

const EMPTY_ROUTE: AdminRoute = { slug: "", fromName: "", toName: "", fromCityId: null, toCityId: null, distanceKm: 100, durationMin: 120, description: "", highlights: [], metaTitle: "", metaDescription: "", isActive: true, isFeatured: false, sortOrder: 100 };
const NONE = "__none";

export function RouteManager({ routes, cities }: { routes: AdminRoute[]; cities: { id: string; name: string; slug: string }[] }) {
  const ed = useEditor<AdminRoute>("/api/admin/routes", "Route");
  const [q, setQ] = useState("");
  const list = useMemo(() => routes.filter((r) => `${r.fromName} ${r.toName}`.toLowerCase().includes(q.trim().toLowerCase())), [routes, q]);
  const e = ed.editing;
  const err = ed.errors;
  const bySlug = (id: string | null) => cities.find((c) => c.id === id);
  const setEnd = (which: "from" | "to", id: string) => {
    if (!e) return;
    const c = cities.find((x) => x.id === id);
    const next = which === "from" ? { fromCityId: c?.id ?? null, fromName: c?.name ?? e.fromName } : { toCityId: c?.id ?? null, toName: c?.name ?? e.toName };
    const merged = { ...e, ...next };
    const a = bySlug(merged.fromCityId)?.slug ?? slugify(merged.fromName);
    const b = bySlug(merged.toCityId)?.slug ?? slugify(merged.toName);
    ed.patch({ ...next, ...(e.id ? {} : { slug: a && b ? `${a}-to-${b}` : "" }) });
  };
  return (
    <div className="space-y-4">
      <Toolbar query={q} onQuery={setQ} placeholder="Search routes" count={routes.length} addLabel="Add route" onAdd={() => ed.open({ ...EMPTY_ROUTE })} />
      <div className="overflow-hidden rounded-xl border bg-card">
        <ul className="divide-y">
          {list.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-primary"><RouteIcon className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.fromName} <span className="text-primary">→</span> {r.toName}</p>
                <p className="truncate text-xs text-muted-foreground">{r.distanceKm} km · ~{Math.floor(r.durationMin / 60)}h {r.durationMin % 60}m · /{r.slug}-taxi</p>
              </div>
              <StatusDots active={r.isActive} featured={r.isFeatured} />
              <RowActions href={`/${r.slug}-taxi`} onEdit={() => ed.open(r)} onDelete={() => r.id && ed.remove(r.id, `${r.fromName} → ${r.toName}`)} />
            </li>
          ))}
          {list.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">No routes yet.</li>}
        </ul>
      </div>

      <EditorDialog
        open={e !== null}
        onClose={ed.close}
        wide
        title={e?.id ? `Edit ${e.fromName} → ${e.toName}` : "Add route"}
        description="Fares for every vehicle are calculated automatically from the distance."
        busy={ed.busy}
        saveLabel="Save route"
        onSave={() => ed.save(({ id: _id, ...rest }) => rest)}
      >
        {e && (
          <div className="grid gap-4 sm:grid-cols-2">
            {(["from", "to"] as const).map((w) => (
              <FormField key={w} label={w === "from" ? "From city" : "To city"} hint="Pick a city page to link, or type a name below">
                <Select value={(w === "from" ? e.fromCityId : e.toCityId) ?? NONE} onValueChange={(v) => setEnd(w, v === NONE ? "" : v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Choose a city" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not linked</SelectItem>
                    {cities.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            ))}
            <FormField label="From (display name)" error={err.fromName}><TextInput value={e.fromName} maxLength={60} onChange={(x) => ed.patch({ fromName: x })} /></FormField>
            <FormField label="To (display name)" error={err.toName}><TextInput value={e.toName} maxLength={60} onChange={(x) => ed.patch({ toName: x })} /></FormField>
            <FormField label="URL slug" hint={`Page: /${e.slug || "from-to-destination"}-taxi`} className="sm:col-span-2" error={err.slug}>
              <TextInput value={e.slug} maxLength={80} onChange={(x) => ed.patch({ slug: slugify(x) })} />
            </FormField>
            <FormField label="Road distance" error={err.distanceKm}>
              <NumberInput value={e.distanceKm} min={1} max={4000} suffix="km" onChange={(x) => ed.patch({ distanceKm: x, ...(e.id ? {} : { durationMin: Math.max(10, Math.round((x / 52) * 60)) }) })} />
            </FormField>
            <FormField label="Drive time" hint="Includes short breaks" error={err.durationMin}><NumberInput value={e.durationMin} min={10} max={6000} suffix="min" onChange={(x) => ed.patch({ durationMin: x })} /></FormField>
            <FormField label="About this trip (optional)" className="sm:col-span-2" error={err.description}><TextArea value={e.description ?? ""} rows={4} maxLength={1500} onChange={(x) => ed.patch({ description: x })} /></FormField>
            <FormField label="Highlights (one per line)" className="sm:col-span-2" error={err.highlights}><LinesInput value={e.highlights} max={10} onChange={(x) => ed.patch({ highlights: x })} placeholder={"Via NH44, smooth highway\nBreakfast stop at Krishnagiri"} /></FormField>
            <FormField label="SEO title (optional)" error={err.metaTitle}><TextInput value={e.metaTitle ?? ""} maxLength={70} onChange={(x) => ed.patch({ metaTitle: x })} placeholder={`${e.fromName || "From"} to ${e.toName || "To"} Taxi – One Way Cab`} /></FormField>
            <FormField label="SEO description (optional)" error={err.metaDescription}><TextArea value={e.metaDescription ?? ""} rows={2} maxLength={170} onChange={(x) => ed.patch({ metaDescription: x })} /></FormField>
            <div className="sm:col-span-2">
              <SerpPreview
                title={e.metaTitle || `${e.fromName || "From"} to ${e.toName || "To"} Taxi – One Way Cab`}
                description={e.metaDescription || `${e.fromName || "From"} to ${e.toName || "To"} cab: ${e.distanceKm} km. One-way drop and round trips with a verified driver, no surge.`}
                path={`/${e.slug || "route"}-taxi`}
              />
            </div>
            <FormField label="Display order"><NumberInput value={e.sortOrder} min={0} max={1000} onChange={(x) => ed.patch({ sortOrder: x })} /></FormField>
            <div className="space-y-2 sm:col-span-2">
              <SwitchRow label="Published" checked={e.isActive} onChange={(x) => ed.patch({ isActive: x })} />
              <SwitchRow label="Featured on home page" checked={e.isFeatured} onChange={(x) => ed.patch({ isFeatured: x })} />
            </div>
          </div>
        )}
      </EditorDialog>
    </div>
  );
}

/* ------------------------------------------------------------ Testimonials */

export type AdminTestimonial = {
  id?: string;
  name: string;
  location: string | null;
  rating: number;
  text: string;
  avatarUrl: string | null;
  tripLabel: string | null;
  source: string | null;
  isActive: boolean;
  sortOrder: number;
};

const EMPTY_T: AdminTestimonial = { name: "", location: "", rating: 5, text: "", avatarUrl: "", tripLabel: "", source: "", isActive: true, sortOrder: 0 };

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => onChange(n)} className="rounded-md p-0.5 transition-transform hover:scale-110">
          <StarIcon className={cn("size-7", n <= value ? "fill-gold text-gold" : "fill-border text-border")} />
        </button>
      ))}
    </div>
  );
}

export function TestimonialManager({ items }: { items: AdminTestimonial[] }) {
  const ed = useEditor<AdminTestimonial>("/api/admin/testimonials", "Testimonial");
  const e = ed.editing;
  const err = ed.errors;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-accent px-4 py-3 text-sm">
        <p>Only publish genuine feedback you have permission to share. Verified reviews from completed trips appear automatically.</p>
        <Button onClick={() => ed.open({ ...EMPTY_T, sortOrder: items.length })}>
          <PlusIcon /> Add testimonial
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((t) => (
          <article key={t.id} className="flex flex-col rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-sm font-bold text-primary">
                {t.avatarUrl ? <Image src={t.avatarUrl} alt="" fill sizes="44px" className="object-cover" unoptimized={t.avatarUrl.startsWith("https://")} /> : initials(t.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{t.name}</p>
                <p className="truncate text-xs text-muted-foreground">{[t.location, t.tripLabel].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <RowActions onEdit={() => ed.open(t)} onDelete={() => t.id && ed.remove(t.id, `the testimonial from ${t.name}`)} />
            </div>
            <p className="mt-3 line-clamp-4 flex-1 text-sm text-muted-foreground">{t.text}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="flex gap-0.5" aria-label={`${t.rating} stars`}>
                {[1, 2, 3, 4, 5].map((n) => <StarIcon key={n} className={cn("size-3.5", n <= t.rating ? "fill-gold text-gold" : "fill-border text-border")} />)}
              </span>
              <StatusDots active={t.isActive} />
            </div>
          </article>
        ))}
        {items.length === 0 && <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">No curated testimonials yet.</p>}
      </div>

      <EditorDialog open={e !== null} onClose={ed.close} title={e?.id ? "Edit testimonial" : "Add testimonial"} busy={ed.busy} saveLabel="Save testimonial" onSave={() => ed.save(({ id: _id, ...rest }) => rest)}>
        {e && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Customer name" error={err.name}><TextInput value={e.name} maxLength={60} onChange={(x) => ed.patch({ name: x })} /></FormField>
            <FormField label="Location" error={err.location}><TextInput value={e.location ?? ""} maxLength={60} placeholder="Coimbatore" onChange={(x) => ed.patch({ location: x })} /></FormField>
            <FormField label="Rating" className="sm:col-span-2"><StarPicker value={e.rating} onChange={(n) => ed.patch({ rating: n })} /></FormField>
            <FormField label="Testimonial" hint={`${e.text.length}/600`} className="sm:col-span-2" error={err.text}><TextArea value={e.text} rows={4} maxLength={600} onChange={(x) => ed.patch({ text: x })} /></FormField>
            <FormField label="Trip (optional)" error={err.tripLabel}><TextInput value={e.tripLabel ?? ""} maxLength={60} placeholder="Chennai → Pondicherry" onChange={(x) => ed.patch({ tripLabel: x })} /></FormField>
            <FormField label="Source (optional)" error={err.source}><TextInput value={e.source ?? ""} maxLength={40} placeholder="Google review" onChange={(x) => ed.patch({ source: x })} /></FormField>
            <FormField label="Photo (optional)"><ImageUpload value={e.avatarUrl} kind="avatar" alt={e.name} onChange={(x) => ed.patch({ avatarUrl: x })} hint="Square photo, with the customer’s consent." /></FormField>
            <div className="space-y-3">
              <FormField label="Display order"><NumberInput value={e.sortOrder} min={0} max={1000} onChange={(x) => ed.patch({ sortOrder: x })} /></FormField>
              <SwitchRow label="Published" checked={e.isActive} onChange={(x) => ed.patch({ isActive: x })} />
            </div>
          </div>
        )}
      </EditorDialog>
    </div>
  );
}
