import type { Metadata } from "next";
import { ArrowLeftIcon, MailIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerActions } from "@/components/admin/customer-actions";
import { WhatsAppIcon } from "@/components/shared/icons";
import { PaymentBadge, StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { getCustomerAdmin } from "@/lib/server/admin-data";
import { requireAdminPage } from "@/lib/server/auth";
import { waLink } from "@/lib/server/notify/whatsapp";
import { formatDateTime, formatINR, formatPhone, initials } from "@/lib/format";
import { TRIP_TYPE_LABEL } from "@/lib/types";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage(props: PageProps<"/admin/customers/[id]">) {
  await requireAdminPage();
  const { id } = await props.params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const data = await getCustomerAdmin(id);
  if (!data) notFound();
  const { customer: c, bookings: rows, stats, referrals, tz } = data;
  return (
    <div className="space-y-5">
      <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Customers
      </Link>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-5">
            <span className="grid size-16 place-items-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">{initials(c.name)}</span>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold">{c.name}</h1>
              <p className="text-sm text-muted-foreground">{stats.tier} member · joined {formatDateTime(c.createdAt, tz, "date")} · code {c.referralCode}</p>
            </div>
            <div className="flex gap-2">
              {c.phone && (
                <>
                  <Button asChild variant="outline" size="icon" aria-label="Call"><a href={`tel:${c.phone}`}><PhoneIcon /></a></Button>
                  <Button asChild size="icon" aria-label="WhatsApp" className="bg-[#25D366] text-white hover:bg-[#1ebe5b]"><a href={waLink(c.phone)} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="size-4" /></a></Button>
                </>
              )}
              <Button asChild variant="outline" size="icon" aria-label="Email"><a href={`mailto:${c.email}`}><MailIcon /></a></Button>
            </div>
          </section>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Completed rides</p><p className="mt-1 text-2xl font-semibold">{stats.rides}</p></div>
            <div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Lifetime value</p><p className="mt-1 text-2xl font-semibold tabular">{formatINR(stats.spent)}</p></div>
            <div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Friends referred</p><p className="mt-1 text-2xl font-semibold">{referrals.length}</p></div>
          </div>
          <section className="overflow-hidden rounded-2xl border bg-card">
            <h2 className="border-b px-5 py-4 font-semibold">Bookings</h2>
            {rows.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No bookings yet.</p>}
            <ul className="divide-y">
              {rows.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/bookings/${b.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-muted/40">
                    <span className="w-28 font-mono text-sm font-semibold">{b.code}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{TRIP_TYPE_LABEL[b.tripType]} · {b.pickupAddress.split(",")[0]}{b.dropAddress ? ` → ${b.dropAddress.split(",")[0]}` : ""}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(b.pickupAt, tz, "short")}</span>
                    <StatusBadge status={b.status} short />
                    {b.status === "COMPLETED" && <PaymentBadge status={b.paymentStatus} />}
                    <span className="w-20 text-right text-sm font-semibold tabular">{formatINR(b.finalFare ?? b.fareEstimate)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <aside className="space-y-5">
          <section className="rounded-2xl border bg-card p-5 text-sm">
            <h2 className="mb-3 font-semibold">Contact</h2>
            <p className="flex items-center gap-2"><MailIcon className="size-4 text-muted-foreground" /> {c.email}</p>
            {c.phone && <p className="mt-1.5 flex items-center gap-2"><PhoneIcon className="size-4 text-muted-foreground" /> {formatPhone(c.phone)}</p>}
            <p className="mt-3 text-xs text-muted-foreground">WhatsApp updates {c.whatsappOptIn ? "on" : "off"} · Offers {c.marketingOptIn ? "on" : "off"}</p>
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="mb-3 font-semibold">Manage</h2>
            <CustomerActions id={c.id} status={c.status} note={c.adminNote ?? ""} balance={c.rewardBalance} />
          </section>
        </aside>
      </div>
    </div>
  );
}
