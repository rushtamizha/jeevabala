import type { Metadata } from "next";
import { ArrowRightIcon, BriefcaseIcon, CheckIcon, ClockIcon, IndianRupeeIcon, LightbulbIcon, MapPinIcon, PhoneCallIcon, PlaneIcon, RouteIcon, TimerIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RateTable, RouteFareTable } from "@/components/site/fare-table";
import { CityCard } from "@/components/site/city-card";
import { RouteCard } from "@/components/site/home-sections";
import { JsonLd } from "@/components/site/json-ld";
import { Em, Faq, Section, SectionHeading } from "@/components/site/sections";
import { WhatsAppIcon } from "@/components/shared/icons";
import { airportParagraph, cityFaqs, cityIntro, cityTips } from "@/lib/city-copy";
import { cityRegion, cityTheme, REGION_LABEL, THEME_LABEL } from "@/lib/city-meta";
import { SeoHero } from "@/components/site/seo-hero";
import type { City, TravelRoute } from "@/db/schema";
import { getCustomerSession } from "@/lib/server/auth";
import { faresForDistance, getActiveVehicleRows, getCities, getCityBySlug, getFleet, getRouteBySlug, nearbyCities, routeFares, routesFromCity } from "@/lib/server/catalog";
import { absoluteUrl } from "@/lib/server/env";
import { haversineKm, signPlace } from "@/lib/server/geo";
import { getBookingConfig } from "@/lib/server/public-data";
import { getSettings } from "@/lib/server/settings";
import { formatDuration, formatINR, formatRate, phoneDigits } from "@/lib/format";
import { metaDescription, seoTitle } from "@/lib/seo";

type Resolved = { kind: "city"; city: City } | { kind: "route"; route: TravelRoute; from: City | null; to: City | null };

async function resolve(slug: string): Promise<Resolved | null> {
  if (!slug.endsWith("-taxi")) return null;
  const base = slug.slice(0, -5);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+){0,8}$/.test(base)) return null;
  if (base.includes("-to-")) {
    const route = await getRouteBySlug(base);
    if (!route) return null;
    const [fromSlug, toSlug] = base.split("-to-");
    const [from, to] = await Promise.all([getCityBySlug(fromSlug), getCityBySlug(toSlug)]);
    return { kind: "route", route, from, to };
  }
  const city = await getCityBySlug(base);
  return city ? { kind: "city", city } : null;
}


const cityPlace = (c: City) => signPlace({ label: `${c.name}, ${c.state}`, lat: c.lat, lng: c.lng });

export async function generateMetadata(props: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const r = await resolve(slug);
  if (!r) return { title: "Page not found", robots: { index: false, follow: true } };
  const s = await getSettings();
  const brand = s.business.name;
  const fleet = await getFleet();
  const minRate = fleet.length ? Math.min(...fleet.map((v) => v.rateCard.oneWay.ac)) : 0;
  const canonical = absoluteUrl(`/${slug}`);
  if (r.kind === "city") {
    const c = r.city;
    const title = seoTitle(c.metaTitle || `${c.name} Taxi Service – One Way Drop & Call Taxi`, brand);
    const description = metaDescription(
      c.metaDescription ||
        `${c.name} taxi from ${formatRate(minRate)}/km: one-way drop taxi, outstation cabs, airport transfers & local call taxi with a verified driver. Instant fare, no surge, pay after the ride.`,
    );
    return {
      title,
      description,
      alternates: { canonical },
      openGraph: { title: title.absolute, description, url: canonical, type: "website", siteName: brand, locale: "en_IN" },
      twitter: { card: "summary_large_image", title: title.absolute, description },
    };
  }
  const rt = r.route;
  const fares = await routeFares(rt);
  const from = fares.length ? Math.min(...fares.map((f) => f.oneWay)) : 0;
  const title = seoTitle(rt.metaTitle || `${rt.fromName} to ${rt.toName} Taxi – One Way from ${formatINR(from)}`, brand);
  const description = metaDescription(
    rt.metaDescription ||
      `${rt.fromName} to ${rt.toName} cab: ${rt.distanceKm} km, ~${formatDuration(rt.durationMin)}. One-way drop from ${formatINR(from)}, round trips too. Verified driver, no surge.`,
  );
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title: title.absolute, description, url: canonical, type: "website", siteName: brand, locale: "en_IN" },
    twitter: { card: "summary_large_image", title: title.absolute, description },
  };
}

export default async function SeoPage(props: PageProps<"/[slug]">) {
  const { slug } = await props.params;
  const r = await resolve(slug);
  if (!r) notFound();
  return r.kind === "city" ? <CityPage city={r.city} slug={slug} /> : <RoutePage route={r.route} from={r.from} to={r.to} slug={slug} />;
}

/* ------------------------------------------------------------------ City */

async function CityPage({ city: c, slug }: { city: City; slug: string }) {
  const session = await getCustomerSession();
  const [s, config, fleet, routes, nearby, vehicleRows, allCities] = await Promise.all([
    getSettings(),
    getBookingConfig(session?.customer ?? null),
    getFleet(),
    routesFromCity(c),
    nearbyCities(c, 16),
    getActiveVehicleRows(),
    getCities(),
  ]);
  const brand = s.business.name;
  const theme = cityTheme(c.slug);
  const region = cityRegion(c);
  const minRate = fleet.length ? Math.min(...fleet.map((v) => v.rateCard.oneWay.ac)) : 0;
  const minBata = fleet.length ? Math.min(...fleet.map((v) => v.rateCard.driverBata)) : 0;
  const minKm = fleet.length ? Math.min(...fleet.map((v) => v.rateCard.oneWay.minKm)) : 0;
  const trips = nearby
    .filter((n) => n.km >= 30)
    .slice(0, 10)
    .map((n) => {
      const durationMin = Math.round((n.km / 52) * 60);
      const fares = faresForDistance(s.pricing, vehicleRows, n.km, durationMin);
      return { ...n, durationMin, from: Math.min(...fares.map((f) => f.oneWay)) };
    });
  const airportCity = c.airportName
    ? { name: c.airportName, km: 0, own: true }
    : (() => {
        const best = allCities
          .filter((x) => x.airportName && x.id !== c.id)
          .map((x) => ({ name: x.airportName as string, km: Math.round(haversineKm(c, x) * 1.25) }))
          .sort((a, b) => a.km - b.km)[0];
        return best ? { ...best, own: false } : null;
      })();
  const facts = {
    name: c.name,
    district: c.district,
    state: c.state,
    brand,
    theme,
    attractions: c.attractions,
    airport: airportCity,
    minRate: formatRate(minRate),
    minBata: formatINR(minBata),
    nearest: trips.map((t) => ({ name: t.city.name, km: t.km, fare: formatINR(t.from) })),
  };
  const intro = c.intro ? [c.intro, cityIntro(facts)[1]] : cityIntro(facts);
  const tips = cityTips(facts);
  const faqs = cityFaqs({ ...facts, vehicles: fleet.map((v) => `${v.name} (${v.seats} seats)`).join(", "), routeCount: routes.length + trips.length });
  const sameRegion = allCities.filter((x) => x.id !== c.id && cityRegion(x) === region).slice(0, 12);
  const nearbyCards = nearby.slice(0, 8).map((n) => n.city);

  const crumbs = [
    { href: "/", label: "Home" },
    { href: "/cities", label: "Cities" },
    { href: `/${slug}`, label: `${c.name} taxi` },
  ];
  const url = absoluteUrl(`/${slug}`);
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "TaxiService",
      "@id": `${url}#service`,
      name: `${c.name} Taxi Service – ${brand}`,
      url,
      serviceType: ["One-way drop taxi", "Outstation cab", "Airport taxi", "Local call taxi"],
      areaServed: { "@type": "City", name: c.name, containedInPlace: { "@type": "AdministrativeArea", name: c.district ? `${c.district} district, ${c.state}` : c.state } },
      provider: {
        "@type": "LocalBusiness",
        name: brand,
        telephone: s.business.phone || undefined,
        priceRange: "₹₹",
        address: { "@type": "PostalAddress", addressLocality: s.business.city, addressRegion: s.business.region, addressCountry: "IN" },
      },
      geo: { "@type": "GeoCoordinates", latitude: c.lat, longitude: c.lng },
      offers: { "@type": "Offer", priceCurrency: "INR", priceSpecification: { "@type": "UnitPriceSpecification", price: minRate / 100, priceCurrency: "INR", unitText: "KMT", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "KMT" } } },
    },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((cr, i) => ({ "@type": "ListItem", position: i + 1, name: cr.label, item: absoluteUrl(cr.href) })) },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
  ];

  const toc = [
    { id: "about", label: `Taxi service in ${c.name}` },
    { id: "fares", label: "Fares & rate card" },
    ...(routes.length || trips.length ? [{ id: "outstation", label: "Outstation trips" }] : []),
    { id: "airport", label: "Airport & station taxi" },
    ...(c.attractions.length ? [{ id: "places", label: "Places to visit" }] : []),
    { id: "how-to-book", label: "How to book" },
    { id: "tips", label: "Travel tips" },
    { id: "faq", label: "FAQ" },
  ];
  const wa = s.business.whatsapp || s.business.phone;

  return (
    <>
      <JsonLd data={ld} />
      <SeoHero
        crumbs={crumbs}
        title={`${c.name}`}
        highlight="Taxi Service"
        subtitle={`One-way drop taxi, outstation cabs, airport transfers and local call taxi in ${c.name} from ${formatRate(minRate)}/km. Instant fare, verified driver, pay after the ride.`}
        chips={[`From ${formatRate(minRate)}/km`, `Driver bata ${formatINR(minBata)}`, "24×7 pickups", THEME_LABEL[theme]]}
        imageUrl={c.imageUrl}
        config={config}
        prefill={{ pickup: cityPlace(c) }}
      />

      {/* Quick facts */}
      <div className="container-page relative z-10 -mt-6">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border shadow-premium lg:grid-cols-4">
          {[
            { icon: IndianRupeeIcon, label: "One-way from", value: `${formatRate(minRate)}/km` },
            { icon: RouteIcon, label: "Outstation routes", value: `${routes.length + trips.length}+` },
            { icon: PlaneIcon, label: airportCity?.own ? "Airport" : "Nearest airport", value: airportCity ? (airportCity.own ? "24×7 transfers" : `${airportCity.km} km`) : "On request" },
            { icon: ClockIcon, label: "Availability", value: "24×7" },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-3 bg-card p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary"><f.icon className="size-[18px]" /></span>
              <div className="min-w-0">
                <dt className="truncate text-[11px] font-medium text-muted-foreground">{f.label}</dt>
                <dd className="truncate text-base font-bold tabular">{f.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>

      <div className="container-page grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-14 lg:py-16">
        <article className="min-w-0 space-y-14">
          <GuideSection id="about" eyebrow={THEME_LABEL[theme]} title={<>Taxi service in <Em>{c.name}</Em></>}>
            {intro.map((para) => (
              <p key={para.slice(0, 24)} className="text-pretty text-[15px] leading-relaxed text-muted-foreground">{para}</p>
            ))}
            <ul className="grid gap-2 sm:grid-cols-2">
              {(c.highlights.length ? c.highlights : [`One-way drop taxi from ${c.name}`, "Round trips & multi-day tours", "Airport & railway station transfers", "Local hourly call taxi (4/8/12 hr)"]).map((h) => (
                <li key={h} className="flex items-start gap-2.5 rounded-xl border bg-card px-3.5 py-3 text-sm font-medium">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" /> {h}
                </li>
              ))}
            </ul>
          </GuideSection>

          <GuideSection id="fares" eyebrow="Fares" title={<>{c.name} taxi <Em>fare & rate card</Em></>}>
            <p className="text-[15px] leading-relaxed text-muted-foreground">Per-kilometre rates by vehicle for one-way drops and round trips, plus airport base fares and local packages. Tap a vehicle for the full breakdown — driver bata is included in every estimate; tolls, parking and state permits are charged as actuals.</p>
            <RateTable fleet={fleet} caption={`Taxi fares in ${c.name} by vehicle`} />
          </GuideSection>

          {(routes.length > 0 || trips.length > 0) && (
            <GuideSection id="outstation" eyebrow="Outstation" title={<>Outstation cabs from <Em>{c.name}</Em></>}>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Book a one-way drop and pay only for the distance you travel, or keep the car for a round trip with the same driver. Distances below are by road; fares are for our most affordable car with the driver bata included.
              </p>
              {routes.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {routes.slice(0, 6).map((rt) => {
                    const f = faresForDistance(s.pricing, vehicleRows, rt.distanceKm, rt.durationMin);
                    return <RouteCard key={rt.id} r={{ slug: rt.slug, fromName: rt.fromName, toName: rt.toName, distanceKm: rt.distanceKm, durationMin: rt.durationMin, from: Math.min(...f.map((x) => x.oneWay)) }} />;
                  })}
                </div>
              )}
              {trips.length > 0 && (
                <div className="overflow-hidden rounded-2xl border bg-card">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b bg-secondary px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:px-5">
                    <span>{c.name} to</span>
                    <span className="w-28 text-right sm:w-32">Distance</span>
                    <span className="w-24 text-right">One way from</span>
                  </div>
                  <ul className="divide-y">
                    {trips.map((t) => (
                      <li key={t.city.id}>
                        <Link href={`/${t.city.slug}-taxi`} className="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-secondary/50 sm:px-5">
                          <span className="flex min-w-0 items-center gap-2 font-semibold">
                            <MapPinIcon className="size-4 shrink-0 text-primary" />
                            <span className="truncate group-hover:text-primary">{t.city.name} taxi</span>
                          </span>
                          <span className="w-28 whitespace-nowrap text-right text-muted-foreground tabular sm:w-32">~{t.km} km · {formatDuration(t.durationMin)}</span>
                          <span className="w-24 text-right font-bold tabular">{formatINR(t.from)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {minKm > 0 && trips.some((t) => t.km < minKm) && (
                    <p className="border-t bg-secondary/60 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">One-way drops shorter than {minKm} km are billed at the {minKm} km minimum — for short hops, a local hourly package is often cheaper.</p>
                  )}
                </div>
              )}
            </GuideSection>
          )}

          <GuideSection id="airport" eyebrow="Transfers" title={<>{c.name} airport & <Em>railway station taxi</Em></>}>
            <p className="text-[15px] leading-relaxed text-muted-foreground">{airportParagraph(facts)}</p>
            <ul className="grid gap-2 sm:grid-cols-3">
              {[
                { icon: PlaneIcon, t: "Flight-aware pickups", d: "We track delays at no extra cost" },
                { icon: TimerIcon, t: "On-time station drops", d: "Buffer planned for every train" },
                { icon: BriefcaseIcon, t: "Luggage help", d: "Boot space matched to your bags" },
              ].map((x) => (
                <li key={x.t} className="rounded-xl border bg-card p-3.5">
                  <x.icon className="size-4 text-primary" />
                  <p className="mt-2 text-sm font-bold">{x.t}</p>
                  <p className="text-xs text-muted-foreground">{x.d}</p>
                </li>
              ))}
            </ul>
            <Link href="/book?trip=AIRPORT" className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-white transition-colors hover:bg-primary">
              Book an airport taxi <ArrowRightIcon className="size-4" />
            </Link>
          </GuideSection>

          {c.attractions.length > 0 && (
            <GuideSection id="places" eyebrow="Sightseeing" title={<>Places to visit in & around <Em>{c.name}</Em></>}>
              <p className="text-[15px] leading-relaxed text-muted-foreground">Keep one car and driver for the day with a local package — unlimited stops, the driver waits at each place, and there is no parking hunt.</p>
              <ol className="grid gap-3 sm:grid-cols-2">
                {c.attractions.map((a, i) => (
                  <li key={a} className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-sm font-bold text-primary tabular">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-sm font-semibold">{a}</span>
                  </li>
                ))}
              </ol>
              <Link href="/book?trip=LOCAL" className="inline-flex h-11 items-center gap-2 rounded-full border bg-card px-5 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary">
                Book a local sightseeing package <ArrowRightIcon className="size-4 text-primary" />
              </Link>
            </GuideSection>
          )}

          <GuideSection id="how-to-book" eyebrow="Booking" title={<>How to book a taxi in <Em>{c.name}</Em></>}>
            <ol className="grid gap-3 sm:grid-cols-3">
              {[
                { t: "Enter your trip", d: `Pickup in ${c.name}, your drop, date and time — or pick a local package.` },
                { t: "See the exact fare", d: "An itemised estimate appears instantly: distance, bata, taxes. No surge." },
                { t: "Confirm & ride", d: "Verify your email once, get your Ride PIN, and pay after the trip by UPI or cash." },
              ].map((x, i) => (
                <li key={x.t} className="relative rounded-2xl border bg-card p-4">
                  <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-bold text-white">{i + 1}</span>
                  <p className="mt-3 font-bold">{x.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{x.d}</p>
                </li>
              ))}
            </ol>
          </GuideSection>

          <GuideSection id="tips" eyebrow="Good to know" title={<>{c.name} <Em>travel tips</Em></>}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {tips.map((t) => (
                <li key={t.title} className="rounded-2xl border bg-card p-4">
                  <p className="flex items-center gap-2 text-sm font-bold"><LightbulbIcon className="size-4 text-primary" /> {t.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
                </li>
              ))}
            </ul>
          </GuideSection>
        </article>

        {/* Sticky sidebar: contents, instant-fare card, same-region links */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <nav aria-label="On this page" className="rounded-2xl border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">On this page</p>
              <ol className="mt-2.5 space-y-0.5">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="block rounded-lg px-2 py-1.5 text-sm font-medium text-foreground/75 transition-colors hover:bg-secondary hover:text-primary">{t.label}</a>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="relative isolate overflow-hidden rounded-2xl bg-night p-5 text-white">
              <div aria-hidden className="absolute -right-16 -top-16 -z-10 size-48 rounded-full bg-[radial-gradient(circle,rgb(251_91_33/0.35),transparent_65%)]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/55">{c.name} one-way from</p>
              <p className="mt-1 text-3xl font-bold tracking-tight tabular">{formatRate(minRate)}<span className="text-base font-medium text-white/60">/km</span></p>
              <p className="mt-1 text-xs text-white/60">Driver bata {formatINR(minBata)}/day · pay after the ride</p>
              <a href="#book" className="sheen mt-4 flex h-11 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold transition-colors hover:bg-(--primary-hover)">
                Get instant fare <ArrowRightIcon className="size-4" />
              </a>
              {(s.business.phone || wa) && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {s.business.phone && (
                    <a href={`tel:${s.business.phone}`} className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-white/10 text-xs font-semibold hover:bg-white/15"><PhoneCallIcon className="size-3.5" /> Call</a>
                  )}
                  {wa && (
                    <a href={`https://wa.me/${phoneDigits(wa)}`} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-white/10 text-xs font-semibold hover:bg-white/15"><WhatsAppIcon className="size-3.5" /> WhatsApp</a>
                  )}
                </div>
              )}
            </div>
            {sameRegion.length > 0 && (
              <div className="rounded-2xl border bg-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">More in {REGION_LABEL[region]}</p>
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {sameRegion.map((x) => (
                    <li key={x.id}>
                      <Link href={`/${x.slug}-taxi`} className="inline-flex h-8 items-center rounded-full bg-secondary px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-primary">{x.name}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      <Faq faqs={faqs} tone="alt" title={<>{c.name} taxi <Em>FAQ</Em></>} subtitle={`Fares, booking and safety questions riders ask before booking a taxi in ${c.name}.`} phone={s.business.phone || undefined} whatsapp={wa || undefined} />

      {nearbyCards.length > 0 && (
        <Section>
          <SectionHeading eyebrow="Nearby" title={<>Taxi service near <Em>{c.name}</Em></>} action={{ href: "/cities", label: "All cities" }} />
          <ul className="reveal-stagger mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {nearbyCards.map((n, i) => (
              <li key={n.id}>
                <CityCard city={n} index={i} priceLabel={`~${nearby.find((x) => x.city.id === n.id)?.km ?? ""} km from ${c.name}`} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

function GuideSection({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 space-y-5">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="mt-3 text-2xl font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/* ----------------------------------------------------------------- Route */

async function RoutePage({ route: rt, from, to, slug }: { route: TravelRoute; from: City | null; to: City | null; slug: string }) {
  const session = await getCustomerSession();
  const [s, config, fleet, fares] = await Promise.all([getSettings(), getBookingConfig(session?.customer ?? null), getFleet(), routeFares(rt)]);
  const brand = s.business.name;
  const cheapest = fares.length ? Math.min(...fares.map((f) => f.oneWay)) : 0;
  const cheapestRt = fares.length ? Math.min(...fares.map((f) => f.roundTrip)) : 0;
  const others = from ? (await routesFromCity(from)).filter((x) => x.id !== rt.id).slice(0, 6) : [];
  const reverseSlug = rt.slug.split("-to-").reverse().join("-to-");
  const reverse = await getRouteBySlug(reverseSlug);

  const faqs = [
    { q: `What is the taxi fare from ${rt.fromName} to ${rt.toName}?`, a: `One-way taxi fare from ${rt.fromName} to ${rt.toName} starts at ${formatINR(cheapest)} and a round trip from ${formatINR(cheapestRt)}, depending on the vehicle. The estimate includes the driver bata; tolls and parking are extra as actuals.` },
    { q: `How far is ${rt.toName} from ${rt.fromName} by road?`, a: `${rt.toName} is about ${rt.distanceKm} km from ${rt.fromName} by road — roughly ${formatDuration(rt.durationMin)} of driving including short breaks.` },
    { q: `Can I book a one-way drop taxi from ${rt.fromName} to ${rt.toName}?`, a: `Yes. Book a one-way drop and pay only for the distance travelled — no return fare.` },
    { q: "Are tolls and parking included?", a: "Toll, parking and any inter-state permit charges are paid as actuals and added to the final bill." },
    { q: "When do I pay?", a: "After the trip. You’ll see the exact amount and a UPI QR code in your booking; cash is also accepted." },
  ];
  const crumbs = [
    { href: "/", label: "Home" },
    ...(from ? [{ href: `/${from.slug}-taxi`, label: `${from.name} taxi` }] : []),
    { href: `/${slug}`, label: `${rt.fromName} to ${rt.toName}` },
  ];
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "TaxiService",
      name: `${rt.fromName} to ${rt.toName} Taxi – ${brand}`,
      url: absoluteUrl(`/${slug}`),
      provider: { "@type": "LocalBusiness", name: brand, telephone: s.business.phone || undefined },
      areaServed: [rt.fromName, rt.toName].map((n) => ({ "@type": "City", name: n })),
      offers: { "@type": "AggregateOffer", priceCurrency: "INR", lowPrice: cheapest / 100, highPrice: Math.max(...fares.map((f) => f.oneWay)) / 100, offerCount: fares.length },
    },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((cr, i) => ({ "@type": "ListItem", position: i + 1, name: cr.label, item: absoluteUrl(cr.href) })) },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
  ];
  const prefillFrom = from ? cityPlace(from) : undefined;
  const prefillTo = to ? cityPlace(to) : undefined;
  const bookHref = (vehicle: string) => `/book?trip=ONE_WAY&vehicle=${vehicle}${from ? `&from=${from.slug}` : ""}${to ? `&to=${to.slug}` : ""}`;

  return (
    <>
      <JsonLd data={ld} />
      <SeoHero
        crumbs={crumbs}
        title={`${rt.fromName} to ${rt.toName}`}
        highlight="Taxi"
        subtitle={`${rt.distanceKm} km · about ${formatDuration(rt.durationMin)}. One-way drop from ${formatINR(cheapest)}, round trips from ${formatINR(cheapestRt)} — with a verified driver and no surge pricing.`}
        chips={[`${rt.distanceKm} km`, `~${formatDuration(rt.durationMin)}`, `From ${formatINR(cheapest)}`, "Pay after the ride"]}
        config={config}
        prefill={{ tripType: "ONE_WAY", pickup: prefillFrom, drop: prefillTo }}
      />

      <section className="section container-page">
        <SectionHeading eyebrow="Fares" title={<>{rt.fromName} to {rt.toName} <Em>cab fare</Em></>} subtitle="Estimated totals by vehicle, including driver bata. Tolls & parking extra." />
        <div className="mt-8">
          <RouteFareTable fares={fares} fleet={fleet} caption={`${rt.fromName} to ${rt.toName} taxi fare by vehicle`} bookHref={bookHref} />
        </div>
      </section>

      <section className="section section-alt">
        <div className="container-page grid gap-4 lg:grid-cols-2 lg:gap-6">
          <div className="rounded-2xl border bg-card p-5 sm:p-6">
            <h2 className="text-lg font-bold">About this trip</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {rt.description ||
                `The ${rt.fromName} to ${rt.toName} drive covers about ${rt.distanceKm} km and typically takes ${formatDuration(rt.durationMin)} with short breaks. We recommend an early start to beat city traffic. Your driver knows the best highway stops for food and rest rooms, and you can add stops on the way — just mention them in the booking note.`}
            </p>
            {rt.highlights.length > 0 && (
              <ul className="mt-4 space-y-2">
                {rt.highlights.map((h) => (
                  <li key={h} className="flex gap-2 text-sm"><CheckIcon className="mt-0.5 size-4 shrink-0 text-success" /> {h}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border bg-card p-5 sm:p-6">
            <h2 className="text-lg font-bold">What’s included</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {["Door-to-door pickup and drop", "Driver bata included in the estimate", "Clean, sanitised car with AC", "Private Ride PIN for safe boarding", "Free cancellation before the driver starts", "Pay after the ride via UPI or cash"].map((x) => (
                <li key={x} className="flex gap-2"><CheckIcon className="mt-0.5 size-4 shrink-0 text-success" /> {x}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {(others.length > 0 || reverse) && (
        <section className="section container-page">
          <h2 className="text-xl font-bold">More <Em>routes</Em></h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {reverse && (
              <li><Link href={`/${reverse.slug}-taxi`} className="inline-flex h-9 items-center rounded-full border bg-card px-4 text-sm font-medium transition-colors hover:border-primary hover:text-primary">{reverse.fromName} to {reverse.toName} taxi</Link></li>
            )}
            {others.map((o) => (
              <li key={o.id}><Link href={`/${o.slug}-taxi`} className="inline-flex h-9 items-center rounded-full border bg-card px-4 text-sm font-medium transition-colors hover:border-primary hover:text-primary">{o.fromName} to {o.toName} taxi</Link></li>
            ))}
            {to && <li><Link href={`/${to.slug}-taxi`} className="inline-flex h-9 items-center rounded-full border bg-card px-4 text-sm font-medium transition-colors hover:border-primary hover:text-primary">{to.name} taxi service</Link></li>}
          </ul>
        </section>
      )}
      <Faq faqs={faqs} />
    </>
  );
}
