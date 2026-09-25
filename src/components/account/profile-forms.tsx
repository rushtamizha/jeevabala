"use client";

import { BookmarkIcon, DownloadIcon, PlusIcon, SaveIcon, ShieldAlertIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { LocationInput } from "@/components/booking/location-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { api, errorMessage } from "@/lib/api-client";
import type { SignedPlace } from "@/lib/types";

export function ProfileForm({ initial }: { initial: { name: string; email: string; phone: string; marketingOptIn: boolean; whatsappOptIn: boolean } }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErrors({});
        try {
          await api("/api/account/profile", {
            method: "PATCH",
            body: { name: v.name, phone: v.phone || undefined, marketingOptIn: v.marketingOptIn, whatsappOptIn: v.whatsappOptIn },
          });
          toast.success("Profile updated");
          router.refresh();
        } catch (err) {
          const f = (err as { fields?: Record<string, string> }).fields;
          if (f) setErrors(f);
          toast.error(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={v.name} maxLength={60} onChange={(e) => setV({ ...v, name: e.target.value })} className="h-11 rounded-xl" aria-invalid={Boolean(errors.name) || undefined} />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Mobile</Label>
          <Input id="phone" value={v.phone} inputMode="tel" maxLength={16} onChange={(e) => setV({ ...v, phone: e.target.value })} className="h-11 rounded-xl" aria-invalid={Boolean(errors.phone) || undefined} />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Email (sign-in identity)</Label>
        <Input value={v.email} readOnly className="h-11 rounded-xl text-muted-foreground" />
      </div>
      <div className="space-y-3 rounded-2xl border p-4">
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>
            <span className="font-medium">WhatsApp ride updates</span>
            <span className="block text-xs text-muted-foreground">Confirmation, driver arrival and payment links.</span>
          </span>
          <Switch checked={v.whatsappOptIn} onCheckedChange={(c) => setV({ ...v, whatsappOptIn: c })} />
        </label>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>
            <span className="font-medium">Offers & rewards</span>
            <span className="block text-xs text-muted-foreground">Occasional member-only discounts. No spam.</span>
          </span>
          <Switch checked={v.marketingOptIn} onCheckedChange={(c) => setV({ ...v, marketingOptIn: c })} />
        </label>
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? <Spinner /> : <SaveIcon />} Save changes
      </Button>
    </form>
  );
}

export function SavedPlaces({ places }: { places: { id: string; label: string; address: string }[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("Home");
  const [place, setPlace] = useState<SignedPlace | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {places.length === 0 && <li className="text-sm text-muted-foreground">No saved places yet. Save Home or Work for one-tap booking.</li>}
        {places.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <span className="flex min-w-0 items-center gap-3">
              <BookmarkIcon className="size-4 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{p.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{p.address}</span>
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${p.label}`}
              onClick={async () => {
                try {
                  await api(`/api/account/places/${p.id}`, { method: "DELETE" });
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
      <div className="space-y-2 rounded-2xl border border-dashed p-3">
        <div className="flex gap-2">
          {["Home", "Work", "Other"].map((l) => (
            <Button key={l} type="button" size="sm" variant={label === l ? "default" : "outline"} onClick={() => setLabel(l)}>
              {l}
            </Button>
          ))}
        </div>
        <LocationInput label="Address" placeholder="Search an address to save" value={place} onChange={setPlace} allowLocate />
        <Button
          type="button"
          size="sm"
          disabled={!place || busy}
          onClick={async () => {
            if (!place) return;
            setBusy(true);
            try {
              await api("/api/account/places", { body: { label, place } });
              setPlace(null);
              toast.success("Place saved");
              router.refresh();
            } catch (err) {
              toast.error(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Spinner /> : <PlusIcon />} Save place
        </Button>
      </div>
    </div>
  );
}

export function PrivacyControls() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        {/* File download from an API route, not a page navigation. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/account/export" download>
          <DownloadIcon /> Download my data
        </a>
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">
            <ShieldAlertIcon /> Delete account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              Your personal details, saved places and credits will be permanently erased. Trip invoices are kept anonymised for legal accounting. Type DELETE to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={confirm !== "DELETE" || busy}
              onClick={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await api("/api/account/delete", { body: { confirm: "DELETE" } });
                  toast.success("Your account has been deleted.");
                  router.replace("/");
                  router.refresh();
                } catch (err) {
                  toast.error(errorMessage(err));
                  setBusy(false);
                }
              }}
            >
              {busy && <Spinner />} Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
