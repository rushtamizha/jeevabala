import type { Metadata } from "next";
import { cn } from "cn";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listCustomers } from "@/lib/server/admin-data";
import { requireAdminPage } from "@/lib/server/auth";
import { getSetting } from "@/lib/server/settings";
import { formatDateTime, formatINR, formatPhone, initials } from "@/lib/format";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage(props: PageProps<"/admin/customers">) {
  await requireAdminPage();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ rows, total, pageSize }, business] = await Promise.all([listCustomers({ q: q || undefined, page }), getSetting("business")]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">Customers</h1>
          <p className="text-sm text-muted-foreground">{total} riders</p>
        </div>
        <form className="relative w-full sm:w-80" action="/admin/customers">
          <SearchIcon className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search name, email or phone" className="h-10 pl-10" maxLength={80} />
        </form>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {rows.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">No customers found.</p>}
        <ul className="divide-y">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/40 sm:px-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-primary">{initials(c.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-medium">
                    {c.name}
                    {c.status === "BLOCKED" && <span className="rounded-full bg-destructive/6 px-2 py-0.5 text-[10px] font-semibold text-destructive ring-1 ring-destructive/40">Blocked</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{c.email}{c.phone ? ` · ${formatPhone(c.phone)}` : ""}</p>
                </div>
                <div className="hidden text-right text-sm sm:block">
                  <p className="font-semibold tabular">{formatINR(c.spent)}</p>
                  <p className="text-xs text-muted-foreground">{c.rides} rides</p>
                </div>
                <div className="hidden w-32 text-right text-xs text-muted-foreground md:block">{c.lastRide ? `Last ${formatDateTime(c.lastRide, business.timezone, "date")}` : "No rides yet"}</div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {pages > 1 && (
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline" size="sm" className={cn(page <= 1 && "pointer-events-none opacity-50")}><Link href={`/admin/customers?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>Previous</Link></Button>
          <Button asChild variant="outline" size="sm" className={cn(page >= pages && "pointer-events-none opacity-50")}><Link href={`/admin/customers?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>Next</Link></Button>
        </div>
      )}
    </div>
  );
}
