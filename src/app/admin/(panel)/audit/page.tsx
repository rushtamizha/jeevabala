import type { Metadata } from "next";
import { cn } from "cn";
import Link from "next/link";
import { RetryNotification } from "@/components/admin/admin-note";
import { Button } from "@/components/ui/button";
import { listAudit, listNotificationsAdmin } from "@/lib/server/admin-data";
import { requireAdminPage } from "@/lib/server/auth";
import { getSetting } from "@/lib/server/settings";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Activity log" };

export default async function AuditPage(props: PageProps<"/admin/audit">) {
  await requireAdminPage();
  const sp = await props.searchParams;
  const view = sp.view === "notifications" ? "notifications" : "audit";
  const page = Math.max(1, Number(sp.page) || 1);
  const business = await getSetting("business");
  const tz = business.timezone;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">Activity log</h1>
        <p className="text-sm text-muted-foreground">Tamper-evident trail of sign-ins, changes and deliveries. Sensitive values are redacted.</p>
      </div>
      <nav className="flex w-fit gap-1 rounded-full bg-secondary p-1">
        {(["audit", "notifications"] as const).map((v) => (
          <Link key={v} href={`/admin/audit?view=${v}`} className={cn("rounded-full px-4 py-1.5 text-sm font-medium", view === v ? "bg-card shadow-sm" : "text-muted-foreground")}>
            {v === "audit" ? "Security & changes" : "Notifications"}
          </Link>
        ))}
      </nav>
      {view === "audit" ? <AuditList page={page} tz={tz} /> : <NotificationList tz={tz} />}
    </div>
  );
}

async function AuditList({ page, tz }: { page: number; tz: string }) {
  const { rows, total } = await listAudit(page);
  const pages = Math.max(1, Math.ceil(total / 50));
  return (
    <>
      <div className="relative overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Details</th><th className="px-4 py-3">IP</th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className={cn(r.action.includes("failed") && "bg-destructive/6/60 dark:bg-destructive/5")}>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDateTime(r.createdAt, tz, "short")}</td>
                <td className="px-4 py-2.5">{r.actorType.toLowerCase()}</td>
                <td className="px-4 py-2.5 font-medium">{r.action}</td>
                <td className="max-w-xs truncate px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.meta ? JSON.stringify(r.meta) : ""}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.ip ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline" size="sm" className={cn(page <= 1 && "pointer-events-none opacity-50")}><Link href={`/admin/audit?page=${page - 1}`}>Newer</Link></Button>
          <Button asChild variant="outline" size="sm" className={cn(page >= pages && "pointer-events-none opacity-50")}><Link href={`/admin/audit?page=${page + 1}`}>Older</Link></Button>
        </div>
      )}
    </>
  );
}

async function NotificationList({ tz }: { tz: string }) {
  const rows = await listNotificationsAdmin();
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      {rows.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">No notifications sent yet. Connect channels in Integrations.</p>}
      <ul className="divide-y text-sm">
        {rows.map(({ n, code }) => (
          <li key={n.id} className="flex items-center gap-3 px-4 py-3">
            <span className="w-24 shrink-0 text-xs text-muted-foreground">{formatDateTime(n.createdAt, tz, "short")}</span>
            <span className="min-w-0 flex-1">
              <span className="font-medium">{n.channel}</span> → {n.audience.toLowerCase()} · {n.event} {code && <span className="font-mono text-xs text-muted-foreground">{code}</span>}
              {n.lastError && <span className="block truncate text-xs text-destructive">{n.lastError}</span>}
            </span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", n.status === "SENT" ? "bg-success/8 text-success ring-success/40" : n.status === "FAILED" ? "bg-destructive/6 text-destructive ring-destructive/40" : "bg-secondary text-muted-foreground ring-border")}>{n.status}</span>
            {n.status === "FAILED" && <RetryNotification id={n.id} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
