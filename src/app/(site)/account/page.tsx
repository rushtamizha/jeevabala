import type { Metadata } from "next";
import { ArrowRightIcon, CrownIcon, PiggyBankIcon, ReceiptIcon, RouteIcon, TriangleAlertIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { BookingCard } from "@/components/account/booking-card";
import { ReferralCard } from "@/components/account/referral-card";
import { CountUp } from "@/components/reactbits/count-up";
import { Button } from "@/components/ui/button";
import { getAccountOverview } from "@/lib/server/account";
import { requireCustomerPage } from "@/lib/server/auth";
import { firstName, formatDateTime, formatINR } from "@/lib/format";
import { zonedParts } from "@/lib/time";

export const metadata: Metadata = { title: "My account" };

export default async function AccountHome() {
  const { customer } = await requireCustomerPage("/account");
  const o = await getAccountOverview(customer);
  const hour = zonedParts(new Date(), o.timezone).hour;
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {/* Welcome card */}
      <section className="relative isolate overflow-hidden rounded-3xl bg-night p-6 text-white sm:p-8">
        <div aria-hidden className="absolute inset-0 -z-10 bg-grid-dark [mask-image:radial-gradient(ellipse_80%_70%_at_80%_20%,black,transparent)]" />
        <div aria-hidden className="absolute -right-24 -top-24 -z-10 size-80 rounded-full bg-[radial-gradient(circle,rgb(251_91_33/0.28),transparent_65%)]" />
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm text-white/60">{greeting},</p>
            <h1 className="mt-0.5 text-[2rem] font-bold leading-tight tracking-[-0.035em] sm:text-[2.5rem]">{firstName(customer.name)}</h1>
            {o.loyalty.enabled && (
              <p className="mt-3 inline-flex h-7 items-center gap-1.5 rounded-full bg-primary/15 px-3 text-xs font-semibold text-primary">
                <CrownIcon className="size-3.5" /> {o.loyalty.current.name} member
                {o.loyalty.current.discountPercent > 0 && <span className="text-white/80">· {o.loyalty.current.discountPercent}% off every ride</span>}
              </p>
            )}
          </div>
          <Button asChild size="lg" className="sheen shadow-glow">
            <Link href="/book">
              Book a ride <ArrowRightIcon />
            </Link>
          </Button>
        </div>
        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
          {[
            { icon: RouteIcon, label: "Rides completed", value: <CountUp to={o.stats.completedRides} duration={1.2} /> },
            { icon: ReceiptIcon, label: "Total paid", value: <CountUp to={o.stats.totalSpent / 100} prefix="₹" duration={1.4} /> },
            { icon: PiggyBankIcon, label: "You’ve saved", value: <CountUp to={o.stats.totalSaved / 100} prefix="₹" duration={1.4} /> },
            { icon: WalletIcon, label: "Reward credits", value: <CountUp to={o.stats.credits / 100} prefix="₹" duration={1.4} /> },
          ].map((s) => (
            <div key={s.label} className="bg-night/90 p-4 backdrop-blur">
              <dt className="flex items-center gap-1.5 text-[11px] font-medium text-white/55">
                <s.icon className="size-3.5 text-primary" /> {s.label}
              </dt>
              <dd className="mt-1.5 text-xl font-bold tracking-tight tabular sm:text-2xl">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {o.unpaid.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-primary/30 bg-accent p-4 sm:p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-white"><TriangleAlertIcon className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Payment pending</p>
            <p className="text-sm text-muted-foreground">Settle your recent trip in seconds with any UPI app.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {o.unpaid.map((b) => (
              <Button key={b.code} asChild size="sm">
                <Link href={`/account/bookings/${b.code}`}>
                  Pay {formatINR(b.amount)} · {b.code}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      )}

      {o.active.length > 0 && (
        <section>
          <PanelTitle title="Upcoming & active" />
          <div className="grid gap-4 xl:grid-cols-2">
            {o.active.map((b) => (
              <BookingCard key={b.code} b={b} tz={o.timezone} />
            ))}
          </div>
        </section>
      )}

      {(o.loyalty.enabled || o.referral.enabled) && (
        <div className="grid gap-4 xl:grid-cols-2">
          {o.loyalty.enabled && (
            <section className="rounded-2xl border bg-card p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Your tier</h2>
                <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-semibold text-primary">
                  <CrownIcon className="size-3.5" /> {o.loyalty.current.name}
                </span>
              </div>
              {o.loyalty.next ? (
                <>
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full origin-left rounded-full bg-primary animate-grow-x" style={{ width: `${Math.max(4, Math.round(o.loyalty.progress * 100))}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {o.loyalty.ridesToNext} more ride{o.loyalty.ridesToNext > 1 ? "s" : ""} to unlock <span className="font-semibold text-foreground">{o.loyalty.next.name}</span> — {o.loyalty.next.discountPercent}% off every ride.
                  </p>
                </>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">You’ve reached our highest tier. Thank you for riding with us.</p>
              )}
              <ol className="mt-5 grid grid-cols-4 gap-2">
                {o.loyalty.tiers.map((t) => {
                  const current = t.name === o.loyalty.current.name;
                  return (
                    <li key={t.name} className={`rounded-xl border p-2.5 text-center transition-colors ${current ? "border-primary bg-accent" : "bg-secondary/60"}`}>
                      <p className={`text-xs font-bold ${current ? "text-primary" : ""}`}>{t.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{t.discountPercent}% · {t.minRides}+</p>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
          {o.referral.enabled && (
            <ReferralCard code={o.referral.code} link={o.referral.link} refereeDiscount={o.referral.refereeDiscount} referrerBonus={o.referral.referrerBonus} brand={o.brand} friends={o.stats.friendsReferred} />
          )}
        </div>
      )}

      <section>
        <PanelTitle title="Recent bookings" action={o.recent.length > 0 ? { href: "/account/bookings", label: "View all" } : undefined} />
        {o.recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-accent text-primary"><RouteIcon className="size-5" /></span>
            <p className="mt-4 font-bold">No rides yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Your bookings and receipts will appear here.</p>
            <Button asChild className="mt-5">
              <Link href="/book">Book your first ride</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {o.recent.map((b) => (
              <BookingCard key={b.code} b={b} tz={o.timezone} />
            ))}
          </div>
        )}
      </section>

      {o.rewards.length > 0 && (
        <section className="rounded-2xl border bg-card">
          <h2 className="border-b px-5 py-4 font-bold">Credit history</h2>
          <ul className="divide-y text-sm">
            {o.rewards.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.note ?? r.type}</span>
                  <span className="block text-xs text-muted-foreground">{formatDateTime(r.createdAt, o.timezone, "date")}</span>
                </span>
                <span className={`shrink-0 font-bold tabular ${r.amount > 0 ? "text-success" : ""}`}>
                  {r.amount > 0 ? "+" : "−"}
                  {formatINR(Math.abs(r.amount))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PanelTitle({ title, action }: { title: string; action?: { href: string; label: string } }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</h2>
      {action && (
        <Link href={action.href} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary">
          {action.label} <ArrowRightIcon className="size-3.5" />
        </Link>
      )}
    </div>
  );
}
