import type { Metadata } from "next";
import { cn } from "cn";
import Link from "next/link";
import {
  BookingPolicyForm,
  BusinessForm,
  LoyaltyForm,
  NotificationsForm,
  PaymentForm,
  PricingForm,
} from "@/components/admin/settings-forms";
import { requireAdminPage } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { id: "business", label: "Business" },
  { id: "pricing", label: "Pricing" },
  { id: "booking", label: "Booking rules" },
  { id: "payment", label: "Payments" },
  { id: "loyalty", label: "Rewards" },
  { id: "notifications", label: "Notifications" },
] as const;

export default async function SettingsPage(props: PageProps<"/admin/settings">) {
  await requireAdminPage();
  const sp = await props.searchParams;
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? "business";
  const s = await getSettings();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">Settings</h1>
        <p className="text-sm text-muted-foreground">Everything customers see and how your business runs.</p>
      </div>
      <nav className="relative flex gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1 scrollbar-none" aria-label="Settings sections">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/settings?tab=${t.id}`}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
        <Link href="/admin/website" className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          Website →
        </Link>
        <Link href="/admin/settings/integrations" className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          Integrations →
        </Link>
      </nav>
      {tab === "business" && <BusinessForm key="business" initial={s.business} />}
      {tab === "pricing" && <PricingForm key="pricing" initial={s.pricing} />}
      {tab === "booking" && <BookingPolicyForm key="booking" initial={s.booking} />}
      {tab === "payment" && <PaymentForm key="payment" initial={s.payment} />}
      {tab === "loyalty" && <LoyaltyForm key="loyalty" initial={s.loyalty} />}
      {tab === "notifications" && <NotificationsForm key="notifications" initial={s.notifications} />}
    </div>
  );
}
