import type { Metadata } from "next";
import { cn } from "cn";
import Link from "next/link";
import { KpiCard } from "@/components/admin/kpi-card";
import { PaymentBadge } from "@/components/shared/status-badge";
import { BanknoteIcon, HourglassIcon, SmartphoneIcon, WalletIcon } from "lucide-react";
import { listPayments } from "@/lib/server/admin-data";
import { requireAdminPage } from "@/lib/server/auth";
import { getSetting } from "@/lib/server/settings";
import { formatDateTime, formatINR } from "@/lib/format";

export const metadata: Metadata = { title: "Payments" };

const TABS = [
  { id: "outstanding", label: "Outstanding" },
  { id: "claims", label: "To verify" },
  { id: "received", label: "Received" },
] as const;

export default async function PaymentsPage(props: PageProps<"/admin/payments">) {
  await requireAdminPage();
  const sp = await props.searchParams;
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? "outstanding";
  const [data, claims, business] = await Promise.all([listPayments(tab), listPayments("claims"), getSetting("business")]);
  const upi = data.byMethod.find((m) => m.method === "UPI");
  const cash = data.byMethod.find((m) => m.method === "CASH");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">Payments</h1>
        <p className="text-sm text-muted-foreground">Manual UPI & cash collections. Money goes straight to you — no gateway fees.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={WalletIcon} label={TABS.find((t) => t.id === tab)!.label} value={formatINR(data.total)} sub={`${data.count} trips`} tone={tab === "outstanding" && data.total > 0 ? "warning" : "default"} />
        <KpiCard icon={HourglassIcon} label="Awaiting verification" value={claims.count} sub={formatINR(claims.total)} href="/admin/payments?tab=claims" tone={claims.count > 0 ? "primary" : "default"} />
        <KpiCard icon={SmartphoneIcon} label="Collected via UPI" value={formatINR(upi?.amount ?? 0)} sub={`${upi?.n ?? 0} payments`} />
        <KpiCard icon={BanknoteIcon} label="Collected in cash" value={formatINR(cash?.amount ?? 0)} sub={`${cash?.n ?? 0} payments`} />
      </div>
      <nav className="flex gap-1 rounded-full bg-secondary p-1" aria-label="Payment status">
        {TABS.map((t) => (
          <Link key={t.id} href={`/admin/payments?tab=${t.id}`} className={cn("flex-1 rounded-full px-3 py-2 text-center text-sm font-medium transition-colors", tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {data.rows.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">Nothing here.</p>}
        <ul className="divide-y">
          {data.rows.map((b) => (
            <li key={b.id}>
              <Link href={`/admin/bookings/${b.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-muted/40">
                <span className="w-28 font-mono text-sm font-semibold">{b.code}</span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{b.contactName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {tab === "received" && b.paidAt ? `Paid ${formatDateTime(b.paidAt, business.timezone, "short")} · ${b.paymentMethod}` : `Completed ${b.completedAt ? formatDateTime(b.completedAt, business.timezone, "short") : ""}`}
                    {b.paymentReference ? ` · ref ${b.paymentReference}` : ""}
                  </span>
                </span>
                <PaymentBadge status={b.paymentStatus} />
                <span className="w-24 text-right font-semibold tabular">{formatINR(b.finalFare ?? 0)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
