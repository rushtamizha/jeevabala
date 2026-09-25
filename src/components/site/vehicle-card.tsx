import { cn } from "cn";
import { ArrowRightIcon, BriefcaseIcon, ChevronDownIcon, ClockIcon, PlaneIcon, RepeatIcon, RouteIcon, SnowflakeIcon, UsersIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatINR, formatRate } from "@/lib/format";
import type { FleetVehicle } from "@/lib/server/catalog";
import { VEHICLE_CATEGORY_LABEL, type VehicleCategory } from "@/lib/types";
import { VehicleArt } from "./vehicle-art";

const categoryLabel = (c: string) => VEHICLE_CATEGORY_LABEL[c as VehicleCategory] ?? c;

type FareRow = { key: string; icon: typeof RouteIcon; label: string; price: string; unit?: string; lines: [string, string][] };

/** The four fare types for one vehicle, ready for an accordion. */
export function fareRows(v: FleetVehicle, nonAcRates = true): FareRow[] {
  const r = v.rateCard;
  const nonAc = nonAcRates && v.hasAc;
  const rows: FareRow[] = [
    {
      key: "one-way",
      icon: RouteIcon,
      label: "One way",
      price: formatRate(r.oneWay.ac),
      unit: "/km",
      lines: [
        ...(nonAc && r.oneWay.nonAc ? ([["Non-AC", `${formatRate(r.oneWay.nonAc)}/km`]] as [string, string][]) : []),
        ["Minimum distance", `${r.oneWay.minKm} km`],
        ["Driver bata", `${formatINR(r.driverBata)}/day`],
      ],
    },
    {
      key: "round-trip",
      icon: RepeatIcon,
      label: "Round trip",
      price: formatRate(r.roundTrip.ac),
      unit: "/km",
      lines: [
        ...(nonAc && r.roundTrip.nonAc ? ([["Non-AC", `${formatRate(r.roundTrip.nonAc)}/km`]] as [string, string][]) : []),
        ["Minimum per day", `${r.roundTrip.minKmPerDay} km`],
        ["Driver bata", `${formatINR(r.driverBata)}/day`],
      ],
    },
    {
      key: "airport",
      icon: PlaneIcon,
      label: "Airport",
      price: formatINR(r.airport.acBase),
      unit: " base",
      lines: [
        ["Includes", `First ${r.airport.baseKm} km`],
        ["After that", `${formatRate(r.airport.acPerKm)}/km`],
        ...(nonAc && r.airport.nonAcBase ? ([["Non-AC base", formatINR(r.airport.nonAcBase)]] as [string, string][]) : []),
      ],
    },
  ];
  if (r.local.length) {
    rows.push({
      key: "local",
      icon: ClockIcon,
      label: "Local hourly",
      price: formatINR(Math.min(...r.local.map((l) => l.ac))),
      unit: " from",
      lines: [
        ...r.local.map((l) => [l.label, formatINR(l.ac)] as [string, string]),
        ["Extra", `${formatRate(r.localExtra.acPerKm)}/km · ${formatINR(r.localExtra.perHour)}/hr`],
      ],
    });
  }
  return rows;
}

/** Accordion of fares — native <details name> so only one opens at a time, zero JavaScript. */
export function FareAccordion({ v, group, className }: { v: FleetVehicle; group: string; className?: string }) {
  return (
    <div className={cn("divide-y rounded-xl border", className)}>
      {fareRows(v).map((row, i) => (
        <details key={row.key} name={group} open={i === 0} className="faq-item group/fare">
          <summary className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-[13px]">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground transition-colors group-open/fare:bg-accent group-open/fare:text-primary">
              <row.icon className="size-3.5" />
            </span>
            <span className="flex-1 font-semibold">{row.label}</span>
            <span className="font-bold tabular">
              {row.unit === " from" && <span className="mr-1 text-[11px] font-medium text-muted-foreground">from</span>}
              {row.price}
              {row.unit && row.unit !== " from" && <span className="text-[11px] font-medium text-muted-foreground">{row.unit}</span>}
            </span>
            <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-300 group-open/fare:rotate-180 group-open/fare:text-primary" />
          </summary>
          <dl className="space-y-1 px-3 pb-3 pl-[3.1rem] text-xs">
            {row.lines.map(([k, val]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-semibold tabular">{val}</dd>
              </div>
            ))}
          </dl>
        </details>
      ))}
    </div>
  );
}

/**
 * Vehicle card — home fleet carousel and the /vehicles page. Studio stage with
 * charcoal car art (or the uploaded photo), specs, a fare accordion covering
 * one way / round trip / airport / local, and two pill actions.
 */
export function VehicleCard({ v, className }: { v: FleetVehicle; detailed?: boolean; className?: string }) {
  const label = categoryLabel(v.category);
  return (
    <article id={v.slug ?? v.id} className={cn("spotlight group flex h-full scroll-mt-28 flex-col rounded-2xl border bg-card p-2 transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-premium", className)}>
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-[radial-gradient(120%_90%_at_50%_0%,#ffffff_0%,#f1f1f1_55%,#e7e7e7_100%)]">
        {v.imageUrl ? (
          <Image src={v.imageUrl} alt={`${v.name}${v.model ? ` – ${v.model}` : ""}`} fill sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 90vw" className="object-cover transition-[scale] duration-700 group-hover:scale-[1.04]" />
        ) : (
          <div className="absolute inset-x-0 bottom-[10%] px-[14%] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-2">
            <VehicleArt category={v.category} tone="ink" />
          </div>
        )}
        <span className="absolute left-2.5 top-2.5 inline-flex h-6 items-center rounded-full bg-white/90 px-2.5 text-[11px] font-semibold shadow-sm backdrop-blur">{label}</span>
        <span className="absolute right-2.5 top-2.5 inline-flex h-6 items-center gap-1 rounded-full bg-foreground/85 px-2.5 text-[11px] font-semibold text-white backdrop-blur">
          <UsersIcon className="size-3" /> {v.seats}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-1.5 pb-1 pt-3">
        <div className="px-0.5">
          <h3 className="truncate text-base font-bold leading-snug">{v.name}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="truncate">{v.model || `${label} · ${v.seats} seater`}</span>
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><UsersIcon className="size-3.5" /> {v.seats} seats</span>
            <span className="inline-flex items-center gap-1"><BriefcaseIcon className="size-3.5" /> {v.luggage} {v.luggage === 1 ? "bag" : "bags"}</span>
            <span className="inline-flex items-center gap-1"><SnowflakeIcon className="size-3.5" /> {v.hasAc ? "AC / Non-AC" : "Non-AC"}</span>
          </p>
        </div>

        <FareAccordion v={v} group={`fares-${v.id}`} className="mt-3" />

        <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
          <Link href={`/vehicles#${v.slug ?? v.id}`} className="inline-flex h-10 items-center justify-center rounded-full bg-secondary text-[13px] font-semibold transition-colors hover:bg-[#ececec]">
            Full rate card
          </Link>
          <Link href={`/book?vehicle=${v.slug ?? v.id}`} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-foreground text-[13px] font-semibold text-white transition-colors hover:bg-primary">
            Book <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
