import { ArrowRightIcon, ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { formatINR, formatRate } from "@/lib/format";
import type { FleetVehicle, RouteFare } from "@/lib/server/catalog";
import { fareRows } from "./vehicle-card";
import { VehicleArt } from "./vehicle-art";

/**
 * Side-by-side rate card as an accordion: each vehicle row shows the headline
 * rates in columns (desktop) and expands to the full breakdown — nothing ever
 * scrolls sideways on a phone.
 */
export function RateTable({ fleet, caption }: { fleet: FleetVehicle[]; caption: string }) {
  const cols = "sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_2rem]";
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <p className="sr-only">{caption}</p>
      <div className={`hidden gap-3 border-b bg-secondary px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:grid ${cols}`}>
        <span>Vehicle</span>
        <span className="text-right">One way</span>
        <span className="text-right">Round trip</span>
        <span className="text-right">Airport</span>
        <span />
      </div>
      <div className="divide-y">
        {fleet.map((v, i) => (
          <details key={v.id} name={`rate-card-${caption.length}`} open={i === 0} className="faq-item group">
            <summary className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_auto_2rem] items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/50 sm:px-5 ${cols}`}>
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-16 shrink-0 items-center rounded-xl bg-secondary px-1.5"><VehicleArt category={v.category} tone="ink" className="w-full" /></span>
                <span className="min-w-0">
                  <span className="block truncate font-bold">{v.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{v.seats} seats{v.model ? ` · ${v.model}` : ""}</span>
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[11px] text-muted-foreground sm:hidden">One way</span>
                <span className="font-bold tabular">{formatRate(v.rateCard.oneWay.ac)}<span className="text-xs font-medium text-muted-foreground">/km</span></span>
              </span>
              <span className="hidden text-right font-bold tabular sm:block">{formatRate(v.rateCard.roundTrip.ac)}<span className="text-xs font-medium text-muted-foreground">/km</span></span>
              <span className="hidden text-right font-bold tabular sm:block">{formatINR(v.rateCard.airport.acBase)}</span>
              <span aria-hidden className="grid size-8 place-items-center justify-self-end rounded-full bg-secondary text-muted-foreground transition-[transform,background-color,color] duration-300 group-open:rotate-180 group-open:bg-primary group-open:text-primary-foreground">
                <ChevronDownIcon className="size-4" />
              </span>
            </summary>
            <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
              {fareRows(v).map((row) => (
                <div key={row.key} className="rounded-xl bg-secondary/70 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <row.icon className="size-3.5 text-primary" /> {row.label}
                  </p>
                  <p className="mt-1 text-lg font-bold tabular">
                    {row.unit === " from" && <span className="mr-1 text-xs font-medium text-muted-foreground">from</span>}
                    {row.price}
                    {row.unit && row.unit !== " from" && <span className="text-xs font-medium text-muted-foreground">{row.unit}</span>}
                  </p>
                  <dl className="mt-1.5 space-y-0.5 text-xs">
                    {row.lines.map(([k, val]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="font-semibold tabular">{val}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 xl:col-span-4">
                <p className="text-xs text-muted-foreground">Tolls, parking & state permits extra as actuals · pay after the ride</p>
                <Link href={`/book?vehicle=${v.slug ?? v.id}`} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-(--primary-hover)">
                  Book {v.name} <ArrowRightIcon className="size-4" />
                </Link>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

/** Total trip fares per vehicle for a specific route. */
export function RouteFareTable({ fares, fleet, caption, bookHref }: { fares: RouteFare[]; fleet: FleetVehicle[]; caption: string; bookHref: (vehicleSlug: string) => string }) {
  const byId = new Map(fleet.map((v) => [v.id, v]));
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <p className="sr-only">{caption}</p>
      {fares.map((f) => {
        const v = byId.get(f.vehicleId);
        if (!v) return null;
        return (
          <div key={f.vehicleId} className="flex flex-col rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-[72px] shrink-0 items-center rounded-xl bg-secondary px-1.5"><VehicleArt category={v.category} tone="ink" className="w-full" /></span>
              <div>
                <p className="text-[15px] font-bold">{v.name}</p>
                <p className="text-xs text-muted-foreground">{v.seats} seats · {formatRate(v.rateCard.oneWay.ac)}/km</p>
              </div>
            </div>
            <dl className="mt-3.5 grid grid-cols-2 gap-3 border-t pt-3">
              <div>
                <dt className="text-[11px] text-muted-foreground">One way</dt>
                <dd className="text-lg font-bold tabular">{formatINR(f.oneWay)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Round trip</dt>
                <dd className="text-lg font-bold tabular">{formatINR(f.roundTrip)}</dd>
              </div>
            </dl>
            <Link href={bookHref(v.slug ?? v.id)} className="mt-4 inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-(--primary-hover)">
              Book {v.name} <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
