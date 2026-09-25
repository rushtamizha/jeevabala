import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  BadgeCheckIcon,
  CarFrontIcon,
  CheckIcon,
  ClockIcon,
  HeadsetIcon,
  MapIcon,
  PlaneIcon,
  RepeatIcon,
  RouteIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  WalletIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SpotlightGroup } from "@/components/reactbits/spotlight";
import { formatDuration, formatINR, formatRate } from "@/lib/format";
import type { FleetVehicle } from "@/lib/server/catalog";
import type { ContentSettings } from "@/lib/settings-schema";
import type { TripType } from "@/lib/types";
import { CityCard, type CityCardData } from "./city-card";
import { FleetRail } from "./fleet-carousel";
import { Em, Section, SectionHeading } from "./sections";
import { VehicleCard } from "./vehicle-card";

/* --------------------------------------------------------------- Services */

const SERVICE: Record<TripType, { title: string; body: string; points: string[]; icon: typeof RouteIcon; image: string }> = {
  ONE_WAY: {
    title: "One-way drop",
    body: "Pay only for the distance you travel — no return fare, to any city.",
    points: ["Door-to-door pickup", "Driver bata in the quote", "Tolls at actuals"],
    icon: RouteIcon,
    image: "/images/services/one-way.svg",
  },
  ROUND_TRIP: {
    title: "Round trip",
    body: "Weekend getaways and multi-day tours with the same car and driver.",
    points: ["Same driver throughout", "Stop wherever you like", "Per-day allowance upfront"],
    icon: RepeatIcon,
    image: "/images/services/round-trip.svg",
  },
  AIRPORT: {
    title: "Airport transfer",
    body: "Flight-aware pickups and drops — we wait when your flight runs late.",
    points: ["Flight tracking", "Meet at arrivals", "Fixed base fare"],
    icon: PlaneIcon,
    image: "/images/services/airport.svg",
  },
  LOCAL: {
    title: "Local hourly",
    body: "Keep a car and driver for errands, shopping and meetings in the city.",
    points: ["4, 8 & 12 hour packages", "Unlimited stops", "Fair extra-hour billing"],
    icon: ClockIcon,
    image: "/images/services/local.svg",
  },
};

function startingPrice(trip: TripType, fleet: FleetVehicle[]) {
  if (!fleet.length) return null;
  const min = (xs: number[]) => Math.min(...xs.filter((x) => x > 0));
  switch (trip) {
    case "ONE_WAY":
      return `${formatRate(min(fleet.map((v) => v.rateCard.oneWay.ac)))}/km`;
    case "ROUND_TRIP":
      return `${formatRate(min(fleet.map((v) => v.rateCard.roundTrip.ac)))}/km`;
    case "AIRPORT":
      return formatINR(min(fleet.map((v) => v.rateCard.airport.acBase)));
    case "LOCAL": {
      const prices = fleet.flatMap((v) => v.rateCard.local.map((l) => l.ac));
      return prices.length ? formatINR(min(prices)) : null;
    }
  }
}

const WHY_ICON = { shield: ShieldCheckIcon, clock: ClockIcon, wallet: WalletIcon, star: StarIcon, car: CarFrontIcon, headset: HeadsetIcon, map: MapIcon, sparkles: SparklesIcon, badge: BadgeCheckIcon, route: RouteIcon } as const;

/** Hairline grid of promises (admin "Why choose us" items). */
function PromiseGrid({ items }: { items: ContentSettings["whyChooseUs"] }) {
  return (
    <div className="reveal grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it, i) => {
        const Icon = WHY_ICON[it.icon] ?? SparklesIcon;
        return (
          <div key={`${it.title}-${i}`} className="group flex gap-3.5 bg-card p-4 sm:p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-white">
              <Icon className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold">{it.title}</h3>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{it.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ServicesSection({ tripTypes, fleet, promises, brand }: { tripTypes: TripType[]; fleet: FleetVehicle[]; promises: ContentSettings["whyChooseUs"]; brand: string }) {
  if (!tripTypes.length) return null;
  return (
    <Section id="services">
      <SectionHeading
        eyebrow="Services"
        title={<>One trusted driver for <Em>every kind of trip</Em></>}
        subtitle={`From a 20-minute airport run to a week-long tour — ${brand} quotes an exact, itemised fare before you book.`}
        action={{ href: "/book", label: "Get a fare" }}
      />
      <SpotlightGroup className="reveal-stagger mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tripTypes.map((t, i) => {
          const s = SERVICE[t];
          const price = startingPrice(t, fleet);
          return (
            <div key={t}>
            <Link href={`/book?trip=${t}`} className="spotlight group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card p-5 transition-[border-color,box-shadow,transform,translate,scale] duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-premium">
              {/* Scene illustration behind the content — soft at rest, clearer on hover */}
              <Image
                src={s.image}
                alt=""
                width={400}
                height={300}
                unoptimized
                loading="lazy"
                className="pointer-events-none absolute -right-8 -top-6 w-[82%] max-w-[270px] select-none opacity-30 transition-[opacity,scale,translate] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] [mask-image:radial-gradient(ellipse_75%_75%_at_75%_30%,black_45%,transparent_80%)] group-hover:-translate-x-1 group-hover:scale-105 group-hover:opacity-60"
              />
              <div className="relative flex items-start justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-accent text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-white">
                  <s.icon className="size-5" />
                </span>
                <span className="text-xs font-semibold tabular text-muted-foreground/70">0{i + 1}</span>
              </div>
              <h3 className="relative mt-4 text-lg font-bold tracking-tight sm:mt-16">{s.title}</h3>
              <p className="relative mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              <ul className="relative mt-4 hidden space-y-1.5 sm:block">
                {s.points.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-[13px] font-medium">
                    <CheckIcon className="size-3.5 shrink-0 text-success" /> {p}
                  </li>
                ))}
              </ul>
              <div className="relative mt-auto pt-4 sm:pt-5">
                <div className="flex items-end justify-between border-t pt-4">
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">Starting at</p>
                    <p className="text-base font-bold tabular">{price ?? "On request"}</p>
                  </div>
                  <span className="grid size-9 place-items-center rounded-full bg-secondary transition-colors duration-300 group-hover:bg-primary group-hover:text-white">
                    <ArrowUpRightIcon className="size-4 transition-transform duration-300 group-hover:rotate-45" />
                  </span>
                </div>
              </div>
            </Link>
            </div>
          );
        })}
      </SpotlightGroup>
      {promises.length > 0 && (
        <div className="mt-4">
          <PromiseGrid items={promises} />
        </div>
      )}
    </Section>
  );
}

/** "Why choose us" band for city & route landing pages. */
export function WhyChooseUs({ items, brand }: { items: ContentSettings["whyChooseUs"]; brand: string }) {
  if (!items.length) return null;
  return (
    <Section tone="alt">
      <SectionHeading eyebrow="Why choose us" title={<>Why riders pick <Em>{brand}</Em></>} />
      <div className="mt-8">
        <PromiseGrid items={items} />
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- Fleet */

export function FleetShowcase({ fleet, title, subtitle }: { fleet: FleetVehicle[]; title?: React.ReactNode; subtitle?: string }) {
  if (!fleet.length) return null;
  return (
    <Section id="fleet" tone="alt">
      <SectionHeading
        eyebrow="Our fleet"
        title={title ?? <>Choose the right car <Em>for the trip</Em></>}
        subtitle={subtitle ?? "Transparent per-km rates for every vehicle. Pick the size that fits your group and luggage."}
        action={{ href: "/vehicles", label: `All ${fleet.length} vehicles` }}
      />
      <SpotlightGroup className="reveal mt-8">
        <FleetRail label="Our vehicles">
          {fleet.map((v) => (
            <VehicleCard key={v.id} v={v} />
          ))}
        </FleetRail>
      </SpotlightGroup>
    </Section>
  );
}

/* -------------------------------------------------------- Popular routes */

export type RouteTeaser = { slug: string; fromName: string; toName: string; distanceKm: number; durationMin: number; from: number };

export function RouteCard({ r }: { r: RouteTeaser }) {
  return (
    <Link href={`/${r.slug}-taxi`} className="spotlight group flex h-full flex-col rounded-2xl border bg-card p-4 transition-[border-color,box-shadow,transform,translate,scale] duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-premium sm:p-5">
      <div className="flex items-stretch gap-3.5">
        {/* Route line: origin ring → dotted path → destination pin */}
        <span aria-hidden className="flex w-3 flex-col items-center py-1">
          <span className="size-3 shrink-0 rounded-full border-[3px] border-success bg-card" />
          <span className="my-1 w-px flex-1 border-l-2 border-dotted border-border" />
          <span className="size-3 shrink-0 rounded-full bg-primary ring-4 ring-primary/15" />
        </span>
        <div className="min-w-0 flex-1 space-y-2.5">
          <p className="truncate text-[15px] font-bold leading-tight">{r.fromName}</p>
          <p className="truncate text-[15px] font-bold leading-tight">{r.toName}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-medium text-muted-foreground">One way from</p>
          <p className="text-lg font-bold leading-tight tabular">{formatINR(r.from)}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1"><RouteIcon className="size-3.5" /> {r.distanceKm} km</span>
          <span aria-hidden className="size-1 rounded-full bg-border" />
          <span className="inline-flex items-center gap-1"><ClockIcon className="size-3.5" /> ~{formatDuration(r.durationMin)}</span>
        </span>
        <span className="inline-flex items-center gap-1 font-semibold text-foreground transition-colors group-hover:text-primary">
          Book <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

export function RoutesGrid({
  routes,
  title,
  eyebrow = "Popular routes",
  action = { href: "/routes", label: "All routes" },
  tone = "light",
}: {
  routes: RouteTeaser[];
  title?: React.ReactNode;
  eyebrow?: string;
  action?: { href: string; label: string };
  tone?: "light" | "alt";
}) {
  if (!routes.length) return null;
  return (
    <Section id="routes" tone={tone}>
      <SectionHeading eyebrow={eyebrow} title={title ?? <>Where our riders <Em>go most</Em></>} subtitle="Indicative one-way fares for our most affordable car. Tap a route to compare every vehicle." action={action} />
      <SpotlightGroup className="reveal-stagger mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {routes.map((r, i) => (
          <div key={r.slug} className={i >= 4 ? "max-sm:hidden" : undefined}>
            <RouteCard r={r} />
          </div>
        ))}
      </SpotlightGroup>
      {action && routes.length > 4 && (
        <Link href={action.href} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full border bg-card text-sm font-semibold sm:hidden">
          View all routes <ArrowRightIcon className="size-4 text-primary" />
        </Link>
      )}
    </Section>
  );
}

/* ---------------------------------------------------------------- Cities */

export function CitiesSection({ cities, total, regions, tone = "alt" }: { cities: CityCardData[]; total: number; regions: { id: string; label: string; count: number }[]; tone?: "light" | "alt" }) {
  if (!cities.length) return null;
  return (
    <Section id="cities" tone={tone}>
      <SectionHeading
        eyebrow="Cities we serve"
        title={<>Taxi service in <Em>{total}+ cities</Em> across Tamil Nadu</>}
        subtitle="Every district, every temple town and every hill station — pick your city for local fares, popular trips and pickup points."
        action={{ href: "/cities", label: `All ${total} cities` }}
      />
      <ul className="reveal-stagger mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {cities.map((c, i) => (
          <li key={c.slug}>
            <CityCard city={c} index={i} />
          </li>
        ))}
      </ul>
      {regions.length > 0 && (
        <nav aria-label="Browse by region" className="reveal mt-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[13px] font-semibold text-muted-foreground">Browse by region:</span>
          {regions.map((r) => (
            <Link key={r.id} href={`/cities#${r.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3.5 text-[13px] font-semibold transition-colors hover:border-primary/40 hover:text-primary">
              {r.label} <span className="text-xs font-medium text-muted-foreground">{r.count}</span>
            </Link>
          ))}
        </nav>
      )}
    </Section>
  );
}
