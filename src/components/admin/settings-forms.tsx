"use client";

import { ArrowDownIcon, ArrowUpIcon, ExternalLinkIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type {
  BookingSettings,
  BusinessSettings,
  ContentSettings,
  LoyaltySettings,
  NotificationSettings,
  PaymentSettings,
  PricingSettings,
} from "@/lib/settings-schema";
import { WHY_ICONS } from "@/lib/settings-schema";
import { ImageListUpload, ImageUpload } from "./image-upload";
import { FormField, MoneyInput, NumberInput, Panel, SaveBar, SwitchRow, TextArea, TextInput, useSettingsForm } from "./form-kit";

/* ------------------------------------------------------------------ Business */

export function BusinessForm({ initial }: { initial: BusinessSettings }) {
  const f = useSettingsForm("business", initial);
  const v = f.value;
  const e = f.errors;
  return (
    <div className="space-y-5">
      <Panel title="Business profile" description="Shown across the website, emails, receipts and WhatsApp messages.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Business name" error={e.name}><TextInput value={v.name} onChange={(x) => f.set("name", x)} maxLength={60} /></FormField>
          <FormField label="Booking code prefix" hint="2–4 capital letters, e.g. SR → SR-7K3M9Q" error={e.bookingPrefix}>
            <TextInput value={v.bookingPrefix} onChange={(x) => f.set("bookingPrefix", x.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))} />
          </FormField>
          <FormField label="Tagline" className="sm:col-span-2" error={e.tagline}><TextInput value={v.tagline} onChange={(x) => f.set("tagline", x)} maxLength={120} /></FormField>
          <FormField label="Phone (shown to customers)" hint="Include country code, e.g. +919876543210" error={e.phone}><TextInput value={v.phone} onChange={(x) => f.set("phone", x)} inputMode="tel" /></FormField>
          <FormField label="WhatsApp number" hint="Leave empty to use the phone number" error={e.whatsapp}><TextInput value={v.whatsapp} onChange={(x) => f.set("whatsapp", x)} inputMode="tel" /></FormField>
          <FormField label="Support email" error={e.email}><TextInput value={v.email} onChange={(x) => f.set("email", x)} type="email" /></FormField>
          <FormField label="GSTIN (optional)" error={e.gstin}><TextInput value={v.gstin} onChange={(x) => f.set("gstin", x.toUpperCase())} maxLength={20} /></FormField>
          <FormField label="Address" className="sm:col-span-2" error={e.address}><TextInput value={v.address} onChange={(x) => f.set("address", x)} maxLength={240} /></FormField>
          <FormField label="City" error={e.city}><TextInput value={v.city} onChange={(x) => f.set("city", x)} /></FormField>
          <FormField label="State / region" error={e.region}><TextInput value={v.region} onChange={(x) => f.set("region", x)} /></FormField>
          <FormField label="Service area latitude" hint="Biases address search to your city"><NumberInput value={v.serviceLat} onChange={(x) => f.set("serviceLat", x)} decimals={6} min={-90} max={90} /></FormField>
          <FormField label="Service area longitude"><NumberInput value={v.serviceLng} onChange={(x) => f.set("serviceLng", x)} decimals={6} min={-180} max={180} /></FormField>
          <FormField label="Announcement bar (optional)" className="sm:col-span-2" hint="Short message at the top of the homepage, e.g. Diwali special — 10% off outstation"><TextInput value={v.announcement} onChange={(x) => f.set("announcement", x)} maxLength={160} /></FormField>
        </div>
      </Panel>
      <Panel title="Driver profile" description="Builds trust — customers see this before and after booking.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Driver name"><TextInput value={v.driver.name} onChange={(x) => f.set("driver", { ...v.driver, name: x })} maxLength={60} /></FormField>
          <FormField label="Years of experience"><NumberInput value={v.driver.experienceYears} onChange={(x) => f.set("driver", { ...v.driver, experienceYears: x })} min={0} max={60} /></FormField>
          <FormField label="Languages (comma separated)" className="sm:col-span-2">
            <TextInput value={v.driver.languages.join(", ")} onChange={(x) => f.set("driver", { ...v.driver, languages: x.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8) })} />
          </FormField>
          <FormField label="Driver photo (optional)" className="sm:col-span-2" error={e["driver.photoUrl"]}><ImageUpload value={v.driver.photoUrl} kind="avatar" alt={v.driver.name} onChange={(x) => f.set("driver", { ...v.driver, photoUrl: x })} hint="Square photo. Shown on booking confirmations." /></FormField>
          <FormField label="Short bio" className="sm:col-span-2"><TextArea value={v.driver.bio} onChange={(x) => f.set("driver", { ...v.driver, bio: x })} rows={3} maxLength={500} /></FormField>
        </div>
        <SwitchRow label="Show verified badge" description="Only if your licence & background verification are complete." checked={v.driver.licenseVerified} onChange={(x) => f.set("driver", { ...v.driver, licenseVerified: x })} />
      </Panel>
      <Panel title="Social links" description="HTTPS links only.">
        <div className="grid gap-4 sm:grid-cols-2">
          {(["instagram", "facebook", "youtube", "x"] as const).map((k) => (
            <FormField key={k} label={k === "x" ? "X (Twitter)" : k[0].toUpperCase() + k.slice(1)} error={e[`social.${k}`]}>
              <TextInput value={v.social[k]} onChange={(x) => f.set("social", { ...v.social, [k]: x })} placeholder="https://" />
            </FormField>
          ))}
        </div>
      </Panel>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={f.save} onReset={f.reset} />
    </div>
  );
}

/* ------------------------------------------------------------------- Pricing */

export function PricingForm({ initial }: { initial: PricingSettings }) {
  const f = useSettingsForm("pricing", initial);
  const v = f.value;
  const setSub = <K extends "oneWay" | "roundTrip" | "airport" | "local" | "nightCharge">(k: K, patch: Partial<PricingSettings[K]>) =>
    f.set(k, { ...v[k], ...patch } as PricingSettings[K]);
  return (
    <div className="space-y-5">
      <Panel title="Car options">
        <FormField label="Offer" hint="Controls the AC / Non-AC toggle in the booking form">
          <Select value={v.acMode} onValueChange={(x) => f.set("acMode", x as PricingSettings["acMode"])}>
            <SelectTrigger className="h-10 w-full sm:w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="both">AC and Non-AC</SelectItem>
              <SelectItem value="ac-only">AC only</SelectItem>
              <SelectItem value="non-ac-only">Non-AC only</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </Panel>

      <Panel title="One-way outstation" actions={<SwitchInline checked={v.oneWay.enabled} onChange={(x) => setSub("oneWay", { enabled: x })} />}>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="AC rate"><MoneyInput value={v.oneWay.acPerKm} onChange={(x) => setSub("oneWay", { acPerKm: x })} suffix="/km" /></FormField>
          <FormField label="Non-AC rate"><MoneyInput value={v.oneWay.nonAcPerKm} onChange={(x) => setSub("oneWay", { nonAcPerKm: x })} suffix="/km" /></FormField>
          <FormField label="Minimum distance"><NumberInput value={v.oneWay.minKm} onChange={(x) => setSub("oneWay", { minKm: x })} suffix="km" /></FormField>
          <FormField label="Driver allowance"><MoneyInput value={v.oneWay.driverBata} onChange={(x) => setSub("oneWay", { driverBata: x })} suffix="/day" /></FormField>
          <FormField label="Base fare"><MoneyInput value={v.oneWay.baseFare} onChange={(x) => setSub("oneWay", { baseFare: x })} /></FormField>
        </div>
      </Panel>

      <Panel title="Round trip" actions={<SwitchInline checked={v.roundTrip.enabled} onChange={(x) => setSub("roundTrip", { enabled: x })} />}>
        <div className="grid gap-4 sm:grid-cols-4">
          <FormField label="AC rate"><MoneyInput value={v.roundTrip.acPerKm} onChange={(x) => setSub("roundTrip", { acPerKm: x })} suffix="/km" /></FormField>
          <FormField label="Non-AC rate"><MoneyInput value={v.roundTrip.nonAcPerKm} onChange={(x) => setSub("roundTrip", { nonAcPerKm: x })} suffix="/km" /></FormField>
          <FormField label="Min km per day"><NumberInput value={v.roundTrip.minKmPerDay} onChange={(x) => setSub("roundTrip", { minKmPerDay: x })} suffix="km" /></FormField>
          <FormField label="Driver allowance"><MoneyInput value={v.roundTrip.driverBataPerDay} onChange={(x) => setSub("roundTrip", { driverBataPerDay: x })} suffix="/day" /></FormField>
        </div>
      </Panel>

      <Panel title="Airport transfers" actions={<SwitchInline checked={v.airport.enabled} onChange={(x) => setSub("airport", { enabled: x })} />}>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="AC base fare"><MoneyInput value={v.airport.acBaseFare} onChange={(x) => setSub("airport", { acBaseFare: x })} /></FormField>
          <FormField label="Non-AC base fare"><MoneyInput value={v.airport.nonAcBaseFare} onChange={(x) => setSub("airport", { nonAcBaseFare: x })} /></FormField>
          <FormField label="Km included in base"><NumberInput value={v.airport.baseKm} onChange={(x) => setSub("airport", { baseKm: x })} suffix="km" /></FormField>
          <FormField label="AC rate after base"><MoneyInput value={v.airport.acPerKm} onChange={(x) => setSub("airport", { acPerKm: x })} suffix="/km" /></FormField>
          <FormField label="Non-AC rate after base"><MoneyInput value={v.airport.nonAcPerKm} onChange={(x) => setSub("airport", { nonAcPerKm: x })} suffix="/km" /></FormField>
          <FormField label="Airport entry fee"><MoneyInput value={v.airport.airportFee} onChange={(x) => setSub("airport", { airportFee: x })} /></FormField>
        </div>
      </Panel>

      <Panel title="Local hourly packages" actions={<SwitchInline checked={v.local.enabled} onChange={(x) => setSub("local", { enabled: x })} />}>
        <div className="space-y-3">
          {v.local.packages.map((p, i) => (
            <div key={i} className="grid items-end gap-3 rounded-xl border p-3 sm:grid-cols-[1.4fr_0.7fr_0.7fr_1fr_1fr_auto]">
              <FormField label="Label"><TextInput value={p.label} onChange={(x) => setSub("local", { packages: v.local.packages.map((q, j) => (j === i ? { ...q, label: x } : q)) })} /></FormField>
              <FormField label="Hours"><NumberInput value={p.hours} onChange={(x) => setSub("local", { packages: v.local.packages.map((q, j) => (j === i ? { ...q, hours: x } : q)) })} min={1} max={24} /></FormField>
              <FormField label="Km"><NumberInput value={p.km} onChange={(x) => setSub("local", { packages: v.local.packages.map((q, j) => (j === i ? { ...q, km: x } : q)) })} min={1} max={500} /></FormField>
              <FormField label="AC price"><MoneyInput value={p.acPrice} onChange={(x) => setSub("local", { packages: v.local.packages.map((q, j) => (j === i ? { ...q, acPrice: x } : q)) })} /></FormField>
              <FormField label="Non-AC price"><MoneyInput value={p.nonAcPrice} onChange={(x) => setSub("local", { packages: v.local.packages.map((q, j) => (j === i ? { ...q, nonAcPrice: x } : q)) })} /></FormField>
              <Button variant="ghost" size="icon" aria-label="Remove package" disabled={v.local.packages.length <= 1} onClick={() => setSub("local", { packages: v.local.packages.filter((_, j) => j !== i) })}>
                <Trash2Icon />
              </Button>
            </div>
          ))}
          {v.local.packages.length < 8 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const n = v.local.packages.length + 1;
                setSub("local", { packages: [...v.local.packages, { id: `pkg${n}-${Date.now().toString(36).slice(-4)}`, label: `${n * 2} hrs · ${n * 20} km`, hours: n * 2, km: n * 20, acPrice: 100000, nonAcPrice: 90000 }] });
              }}
            >
              <PlusIcon /> Add package
            </Button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Extra km (AC)"><MoneyInput value={v.local.acExtraPerKm} onChange={(x) => setSub("local", { acExtraPerKm: x })} suffix="/km" /></FormField>
          <FormField label="Extra km (Non-AC)"><MoneyInput value={v.local.nonAcExtraPerKm} onChange={(x) => setSub("local", { nonAcExtraPerKm: x })} suffix="/km" /></FormField>
          <FormField label="Extra hour"><MoneyInput value={v.local.extraPerHour} onChange={(x) => setSub("local", { extraPerHour: x })} suffix="/hr" /></FormField>
        </div>
      </Panel>

      <Panel title="Surcharges, tax & rounding">
        <SwitchRow label="Night charge" description="Applied to the distance/base fare for night pickups" checked={v.nightCharge.enabled} onChange={(x) => setSub("nightCharge", { enabled: x })} />
        {v.nightCharge.enabled && (
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="From hour (0–23)"><NumberInput value={v.nightCharge.startHour} onChange={(x) => setSub("nightCharge", { startHour: x })} min={0} max={23} /></FormField>
            <FormField label="Until hour (0–23)"><NumberInput value={v.nightCharge.endHour} onChange={(x) => setSub("nightCharge", { endHour: x })} min={0} max={23} /></FormField>
            <FormField label="Surcharge"><NumberInput value={v.nightCharge.percent} onChange={(x) => setSub("nightCharge", { percent: x })} min={0} max={100} suffix="%" /></FormField>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="GST / tax" hint="Leave 0 if you’re not GST registered"><NumberInput value={v.taxPercent} onChange={(x) => f.set("taxPercent", x)} min={0} max={28} decimals={1} suffix="%" /></FormField>
          <FormField label="Round totals to nearest">
            <Select value={String(v.roundTo)} onValueChange={(x) => f.set("roundTo", Number(x) as PricingSettings["roundTo"])}>
              <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 5, 10, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>₹{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <FormField label="Fare notes (one per line)" hint="Shown under every estimate and on the fare chart">
          <TextArea value={v.notes.join("\n")} onChange={(x) => f.set("notes", x.split("\n").map((s) => s.trim()).filter((s) => s.length >= 3).slice(0, 6))} rows={3} />
        </FormField>
      </Panel>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={f.save} onReset={f.reset} />
    </div>
  );
}

function SwitchInline({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <span className="text-muted-foreground">{checked ? "Enabled" : "Disabled"}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/* ------------------------------------------------------------------- Booking */

export function BookingPolicyForm({ initial }: { initial: BookingSettings }) {
  const f = useSettingsForm("booking", initial);
  const v = f.value;
  return (
    <div className="space-y-5">
      <Panel title="Availability">
        <SwitchRow label="Accept online bookings" description="Turn off when you’re on leave — the booking form shows your message and contact buttons instead." checked={v.acceptingBookings} onChange={(x) => f.set("acceptingBookings", x)} />
        <FormField label="Message when paused"><TextInput value={v.pausedMessage} onChange={(x) => f.set("pausedMessage", x)} maxLength={200} /></FormField>
        <SwitchRow label="Block overlapping bookings" description="As a single driver, stop customers from booking slots that clash with confirmed rides." checked={v.blockOverlaps} onChange={(x) => f.set("blockOverlaps", x)} />
        <SwitchRow label="Auto-confirm bookings" description="Skip manual acceptance when the slot is free (you can still cancel)." checked={v.autoConfirm} onChange={(x) => f.set("autoConfirm", x)} />
      </Panel>
      <Panel title="Timing rules">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Minimum notice" hint="How far in advance customers must book"><NumberInput value={v.minLeadMinutes} onChange={(x) => f.set("minLeadMinutes", x)} min={0} max={10080} suffix="min" /></FormField>
          <FormField label="Booking window"><NumberInput value={v.maxAdvanceDays} onChange={(x) => f.set("maxAdvanceDays", x)} min={1} max={365} suffix="days" /></FormField>
          <FormField label="Buffer between rides" hint="Travel/rest time added around each ride"><NumberInput value={v.bufferMinutes} onChange={(x) => f.set("bufferMinutes", x)} min={0} max={720} suffix="min" /></FormField>
          <FormField label="Free cancellation until" hint="Minutes before pickup (after you confirm)"><NumberInput value={v.customerCancelCutoffMinutes} onChange={(x) => f.set("customerCancelCutoffMinutes", x)} min={0} max={2880} suffix="min" /></FormField>
          <FormField label="Max upcoming rides per customer"><NumberInput value={v.maxActiveBookingsPerCustomer} onChange={(x) => f.set("maxActiveBookingsPerCustomer", x)} min={1} max={20} /></FormField>
        </div>
      </Panel>
      <Panel title="Safety">
        <SwitchRow label="Require Ride PIN to start trips" description="The customer shares a private 4-digit PIN at pickup — prevents wrong-passenger pickups." checked={v.requireRidePin} onChange={(x) => f.set("requireRidePin", x)} />
      </Panel>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={f.save} onReset={f.reset} />
    </div>
  );
}

/* ------------------------------------------------------------------- Payment */

export function PaymentForm({ initial }: { initial: PaymentSettings }) {
  const f = useSettingsForm("payment", initial);
  const v = f.value;
  return (
    <div className="space-y-5">
      <Panel title="UPI" description="Customers see a QR code and one-tap UPI buttons for the exact amount after each trip.">
        <SwitchRow label="Accept UPI payments" checked={v.upiEnabled} onChange={(x) => f.set("upiEnabled", x)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="UPI ID (VPA)" hint="e.g. yourname@okhdfcbank — a merchant/business UPI works best" error={f.errors.upiId}>
            <TextInput value={v.upiId} onChange={(x) => f.set("upiId", x.trim())} placeholder="name@bank" autoCapitalize="none" />
          </FormField>
          <FormField label="Payee name" hint="Name shown in the customer’s UPI app"><TextInput value={v.payeeName} onChange={(x) => f.set("payeeName", x)} maxLength={60} /></FormField>
        </div>
      </Panel>
      <Panel title="Cash & instructions">
        <SwitchRow label="Accept cash" description="Customers can tell you they paid in cash; you confirm it." checked={v.cashEnabled} onChange={(x) => f.set("cashEnabled", x)} />
        <FormField label="Payment instructions"><TextArea value={v.instructions} onChange={(x) => f.set("instructions", x)} rows={3} maxLength={300} /></FormField>
      </Panel>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={f.save} onReset={f.reset} />
    </div>
  );
}

/* ------------------------------------------------------------------- Loyalty */

export function LoyaltyForm({ initial }: { initial: LoyaltySettings }) {
  const f = useSettingsForm("loyalty", initial);
  const v = f.value;
  return (
    <div className="space-y-5">
      <Panel title="Rider tiers" description="Automatic discounts that reward repeat customers — the #1 retention lever.">
        <SwitchRow label="Enable rewards programme" checked={v.enabled} onChange={(x) => f.set("enabled", x)} />
        <div className="space-y-2">
          {v.tiers.map((t, i) => (
            <div key={i} className="grid items-end gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <FormField label="Tier name"><TextInput value={t.name} onChange={(x) => f.set("tiers", v.tiers.map((q, j) => (j === i ? { ...q, name: x } : q)))} maxLength={20} /></FormField>
              <FormField label="From completed rides"><NumberInput value={t.minRides} onChange={(x) => f.set("tiers", v.tiers.map((q, j) => (j === i ? { ...q, minRides: x } : q)))} min={0} max={1000} /></FormField>
              <FormField label="Discount"><NumberInput value={t.discountPercent} onChange={(x) => f.set("tiers", v.tiers.map((q, j) => (j === i ? { ...q, discountPercent: x } : q)))} min={0} max={50} decimals={1} suffix="%" /></FormField>
              <Button variant="ghost" size="icon" aria-label="Remove tier" disabled={v.tiers.length <= 1} onClick={() => f.set("tiers", v.tiers.filter((_, j) => j !== i))}>
                <Trash2Icon />
              </Button>
            </div>
          ))}
          {v.tiers.length < 6 && (
            <Button variant="outline" size="sm" onClick={() => f.set("tiers", [...v.tiers, { name: "New tier", minRides: (v.tiers.at(-1)?.minRides ?? 0) + 10, discountPercent: 10 }])}>
              <PlusIcon /> Add tier
            </Button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Max tier discount per ride"><MoneyInput value={v.maxTierDiscount} onChange={(x) => f.set("maxTierDiscount", x)} /></FormField>
          <FormField label="Credits usable per ride" hint="Max % of a fare payable with reward credits"><NumberInput value={v.maxRedeemPercent} onChange={(x) => f.set("maxRedeemPercent", x)} min={0} max={100} suffix="%" /></FormField>
        </div>
      </Panel>
      <Panel title="Referrals">
        <SwitchRow label="Enable referral programme" checked={v.referral.enabled} onChange={(x) => f.set("referral", { ...v.referral, enabled: x })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Friend’s first-ride discount"><MoneyInput value={v.referral.refereeDiscount} onChange={(x) => f.set("referral", { ...v.referral, refereeDiscount: x })} /></FormField>
          <FormField label="Referrer credit" hint="Credited when the friend’s first ride is paid"><MoneyInput value={v.referral.referrerBonus} onChange={(x) => f.set("referral", { ...v.referral, referrerBonus: x })} /></FormField>
        </div>
      </Panel>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={f.save} onReset={f.reset} />
    </div>
  );
}

/* ------------------------------------------------------------- Notifications */

export function NotificationsForm({ initial }: { initial: NotificationSettings }) {
  const f = useSettingsForm("notifications", initial);
  const v = f.value;
  return (
    <div className="space-y-5">
      <Panel title="Alerts to you" description="New requests, cancellations, payment claims and reviews.">
        <SwitchRow label="Telegram" description="Instant alerts with one-tap Accept / Decline." checked={v.admin.telegram} onChange={(x) => f.set("admin", { ...v.admin, telegram: x })} />
        <SwitchRow label="WhatsApp" checked={v.admin.whatsapp} onChange={(x) => f.set("admin", { ...v.admin, whatsapp: x })} />
        <SwitchRow label="Email" checked={v.admin.email} onChange={(x) => f.set("admin", { ...v.admin, email: x })} />
        <FormField label="Alert email address" hint="Defaults to your login email when empty" error={f.errors.adminEmail}><TextInput value={v.adminEmail} onChange={(x) => f.set("adminEmail", x.trim())} type="email" /></FormField>
      </Panel>
      <Panel title="Updates to customers" description="Confirmation, driver on the way, arrival, bill & receipt.">
        <SwitchRow label="Email" checked={v.customer.email} onChange={(x) => f.set("customer", { ...v.customer, email: x })} />
        <SwitchRow label="WhatsApp" description="Requires WhatsApp Cloud API or Twilio (CallMeBot can only message you)." checked={v.customer.whatsapp} onChange={(x) => f.set("customer", { ...v.customer, whatsapp: x })} />
      </Panel>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={f.save} onReset={f.reset} />
    </div>
  );
}

/* ------------------------------------------------------------------- Content */

const WHY_LABEL: Record<(typeof WHY_ICONS)[number], string> = {
  shield: "Shield",
  clock: "Clock",
  wallet: "Wallet",
  star: "Star",
  car: "Car",
  headset: "Support",
  map: "Map",
  sparkles: "Sparkles",
  badge: "Badge",
  route: "Route",
};

export function ContentForm({ initial }: { initial: ContentSettings }) {
  const f = useSettingsForm("content", initial);
  const v = f.value;
  const e = f.errors;
  const slides = [...v.heroImages, ...(v.heroImageUrl && !v.heroImages.includes(v.heroImageUrl) ? [v.heroImageUrl] : [])].filter(Boolean);
  const moveWhy = (i: number, d: -1 | 1) => {
    const next = [...v.whyChooseUs];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    f.set("whyChooseUs", next);
  };
  return (
    <div className="space-y-5">
      <Panel title="Hero background" description="Full-screen slider behind the booking form. Photos cross-fade every 5 seconds.">
        <ImageListUpload
          value={slides}
          alt="Taxi service hero"
          onChange={(urls) => {
            f.set("heroImages", urls);
            f.set("heroImageUrl", "");
          }}
        />
      </Panel>
      <Panel title="Hero text">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Badge text (optional)" hint="Shown in the pill above the headline" error={e.heroEyebrow}><TextInput value={v.heroEyebrow} onChange={(x) => f.set("heroEyebrow", x)} maxLength={60} placeholder="Now booking across Chennai & beyond" /></FormField>
          <FormField label="Headline" error={e.heroTitle}><TextInput value={v.heroTitle} onChange={(x) => f.set("heroTitle", x)} maxLength={80} /></FormField>
          <FormField label="Highlighted phrase" hint="Shown in orange" error={e.heroHighlight}><TextInput value={v.heroHighlight} onChange={(x) => f.set("heroHighlight", x)} maxLength={40} /></FormField>
          <FormField label="Subheading" className="sm:col-span-2" error={e.heroSubtitle}><TextArea value={v.heroSubtitle} onChange={(x) => f.set("heroSubtitle", x)} rows={2} maxLength={220} /></FormField>
        </div>
      </Panel>
      <Panel title="Why choose us" description="Up to 8 short reasons, shown as cards on the home and city pages.">
        {v.whyChooseUs.map((w, i) => (
          <div key={i} className="grid items-start gap-3 rounded-xl border p-3 sm:grid-cols-[150px_1fr_auto]">
            <FormField label="Icon">
              <Select value={w.icon} onValueChange={(x) => f.set("whyChooseUs", v.whyChooseUs.map((q, j) => (j === i ? { ...q, icon: x as typeof w.icon } : q)))}>
                <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WHY_ICONS.map((ic) => <SelectItem key={ic} value={ic}>{WHY_LABEL[ic]}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid gap-2">
              <FormField label="Title" error={e[`whyChooseUs.${i}.title`]}><TextInput value={w.title} maxLength={40} onChange={(x) => f.set("whyChooseUs", v.whyChooseUs.map((q, j) => (j === i ? { ...q, title: x } : q)))} /></FormField>
              <TextArea value={w.body} rows={2} maxLength={140} placeholder="One short sentence" onChange={(x) => f.set("whyChooseUs", v.whyChooseUs.map((q, j) => (j === i ? { ...q, body: x } : q)))} />
            </div>
            <div className="flex gap-0.5 sm:flex-col sm:pt-6">
              <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => moveWhy(i, -1)}><ArrowUpIcon /></Button>
              <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === v.whyChooseUs.length - 1} onClick={() => moveWhy(i, 1)}><ArrowDownIcon /></Button>
              <Button variant="ghost" size="icon-sm" aria-label="Remove" className="text-destructive hover:text-destructive" onClick={() => f.set("whyChooseUs", v.whyChooseUs.filter((_, j) => j !== i))}><Trash2Icon /></Button>
            </div>
          </div>
        ))}
        {v.whyChooseUs.length < 8 && (
          <Button variant="outline" size="sm" onClick={() => f.set("whyChooseUs", [...v.whyChooseUs, { icon: "star", title: "", body: "" }])}>
            <PlusIcon /> Add reason
          </Button>
        )}
      </Panel>
      <Panel
        title="FAQ"
        description="Shown on the home page and marked up for Google rich results."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/routes">Manage popular routes <ExternalLinkIcon /></Link>
          </Button>
        }
      >
        {v.faqs.map((q, i) => (
          <div key={i} className="space-y-2 rounded-xl border p-3">
            <div className="flex gap-2">
              <Input value={q.q} onChange={(ev) => f.set("faqs", v.faqs.map((x, j) => (j === i ? { ...x, q: ev.target.value } : x)))} placeholder="Question" className="h-10" maxLength={160} aria-label={`Question ${i + 1}`} />
              <Button variant="ghost" size="icon" aria-label="Remove question" className="text-destructive hover:text-destructive" onClick={() => f.set("faqs", v.faqs.filter((_, j) => j !== i))}><Trash2Icon /></Button>
            </div>
            <TextArea value={q.a} onChange={(x) => f.set("faqs", v.faqs.map((y, j) => (j === i ? { ...y, a: x } : y)))} rows={2} placeholder="Answer" maxLength={800} aria-label={`Answer ${i + 1}`} />
          </div>
        ))}
        {v.faqs.length < 20 && (
          <Button variant="outline" size="sm" onClick={() => f.set("faqs", [...v.faqs, { q: "", a: "" }])}>
            <PlusIcon /> Add question
          </Button>
        )}
      </Panel>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={f.save} onReset={f.reset} />
    </div>
  );
}
