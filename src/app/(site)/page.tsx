import { CtaSection } from "@/components/site/cta-section";
import { CitiesSection, FleetShowcase, RoutesGrid, ServicesSection } from "@/components/site/home-sections";
import { cityRegion, REGION_LABEL, type CityRegion } from "@/lib/city-meta";
import { Hero } from "@/components/site/hero";
import { JsonLd } from "@/components/site/json-ld";
import { Faq } from "@/components/site/sections";
import { Testimonials } from "@/components/site/testimonials";
import { getCustomerSession } from "@/lib/server/auth";
import { faresForDistance, getActiveVehicleRows, getCities, getFleet, getRoutes, getTestimonials } from "@/lib/server/catalog";
import { getBookingConfig, getPublicStats } from "@/lib/server/public-data";
import { getSettings } from "@/lib/server/settings";
import { absoluteUrl } from "@/lib/server/env";
import type { Metadata } from "next";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const session = await getCustomerSession();
  const [s, config, stats, testimonials, fleet, routes, cities, vehicleRows] = await Promise.all([
    getSettings(),
    getBookingConfig(session?.customer ?? null),
    getPublicStats(),
    getTestimonials(),
    getFleet(),
    getRoutes(),
    getCities(),
    getActiveVehicleRows(),
  ]);
  const ref = typeof sp.ref === "string" && /^[A-Z0-9]{4,16}$/i.test(sp.ref) ? sp.ref.toUpperCase() : undefined;
  const promo = typeof sp.promo === "string" && /^[A-Z0-9-]{3,24}$/i.test(sp.promo) ? sp.promo.toUpperCase() : undefined;
  const b = s.business;
  const routeTeasers = routes.slice(0, 9).map((r) => {
    const fares = faresForDistance(s.pricing, vehicleRows, r.distanceKm, r.durationMin);
    return { slug: r.slug, fromName: r.fromName, toName: r.toName, distanceKm: r.distanceKm, durationMin: r.durationMin, from: Math.min(...fares.map((f) => f.oneWay)) };
  });

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: s.content.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const businessLd = {
    "@context": "https://schema.org",
    "@type": "TaxiService",
    name: b.name,
    url: absoluteUrl("/"),
    description: b.tagline,
    areaServed: cities.slice(0, 30).map((c) => ({ "@type": "City", name: c.name })),
    provider: { "@type": "LocalBusiness", name: b.name, telephone: b.phone || undefined, address: b.address || `${b.city}, ${b.region}`, priceRange: "₹₹" },
    ...(stats.avgRating && stats.reviewCount >= 3 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: stats.avgRating, reviewCount: stats.reviewCount } } : {}),
  };

  return (
    <>
      <JsonLd data={[businessLd, faqLd]} />
      <Hero
        config={config}
        prefill={{ ref, promo }}
        title={s.content.heroTitle}
        highlight={s.content.heroHighlight}
        subtitle={s.content.heroSubtitle}
        city={b.city}
        region={b.region}
        announcement={b.announcement || undefined}
        eyebrow={s.content.heroEyebrow || undefined}
        images={[...s.content.heroImages, s.content.heroImageUrl].filter((x): x is string => Boolean(x))}
        experienceYears={b.driver.experienceYears}
        stats={stats}
        phone={b.phone || undefined}
        whatsapp={b.whatsapp || b.phone || undefined}
      />
      <ServicesSection tripTypes={config.tripTypes} fleet={fleet} promises={s.content.whyChooseUs} brand={b.name} />
      <FleetShowcase fleet={fleet} />
      <RoutesGrid routes={routeTeasers} />
      <CitiesSection
        cities={cities.filter((c) => c.isFeatured).slice(0, 8)}
        total={cities.length}
        regions={(["north", "west", "central", "south", "other"] as CityRegion[]).map((r) => ({ id: r, label: REGION_LABEL[r], count: cities.filter((c) => cityRegion(c) === r).length })).filter((r) => r.count > 0)}
      />
      <Faq faqs={s.content.faqs} phone={b.phone || undefined} whatsapp={b.whatsapp || b.phone || undefined} />
      <Testimonials reviews={testimonials} tone="alt" />
      <CtaSection phone={b.phone || undefined} whatsapp={b.whatsapp || b.phone || undefined} loyalty={s.loyalty} />
    </>
  );
}
