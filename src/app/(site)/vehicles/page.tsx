import type { Metadata } from "next";
import { RateTable } from "@/components/site/fare-table";
import { JsonLd } from "@/components/site/json-ld";
import { PageHeader } from "@/components/site/page-header";
import { Em, FareChart, SectionHeading } from "@/components/site/sections";
import { VehicleCard } from "@/components/site/vehicle-card";
import { getFleet } from "@/lib/server/catalog";
import { absoluteUrl } from "@/lib/server/env";
import { getSettings } from "@/lib/server/settings";
import { formatRate } from "@/lib/format";
import { metaDescription, seoTitle } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [fleet, s] = await Promise.all([getFleet(), getSettings()]);
  const min = fleet.length ? Math.min(...fleet.map((v) => v.rateCard.oneWay.ac)) : 0;
  const title = seoTitle("Taxi Vehicles & Fares – Sedan, SUV, Innova", s.business.name);
  const description = metaDescription(`Compare our fleet and per-km taxi fares: ${fleet.map((v) => v.name).join(", ")}. One-way cabs from ${formatRate(min)}/km, driver bata shown upfront.`);
  const url = absoluteUrl("/vehicles");
  return { title, description, alternates: { canonical: url }, openGraph: { title: title.absolute, description, url }, twitter: { card: "summary_large_image", title: title.absolute, description } };
}

export default async function VehiclesPage() {
  const [fleet, s] = await Promise.all([getFleet(), getSettings()]);
  const crumbs = [
    { href: "/", label: "Home" },
    { href: "/vehicles", label: "Vehicles & fares" },
  ];
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: fleet.map((v, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Service",
          name: `${v.name} taxi`,
          description: v.description ?? `${v.seats}-seater ${v.name}`,
          provider: { "@type": "LocalBusiness", name: s.business.name },
          offers: { "@type": "Offer", priceCurrency: "INR", priceSpecification: { "@type": "UnitPriceSpecification", price: v.rateCard.oneWay.ac / 100, priceCurrency: "INR", unitText: "KMT" } },
        },
      })),
    },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: absoluteUrl(c.href) })) },
  ];
  return (
    <>
      <JsonLd data={ld} />
      <PageHeader
        crumbs={crumbs}
        eyebrow="Our fleet"
        title={<>Vehicles & <Em>transparent fares</Em></>}
        subtitle="From budget hatchbacks to 12-seater tempo travellers. Every car is clean, insured and driven by a verified professional. Rates are per kilometre; tolls, parking and permits are extra as actuals."
        points={["No surge pricing", "Driver bata shown upfront", "AC & Non-AC options", "Pay after the ride"]}
      />
      <section className="section container-page !pt-0">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fleet.map((v) => (
            <VehicleCard key={v.id} v={v} detailed />
          ))}
        </div>
      </section>
      <section id="fares" className="section section-alt">
        <div className="container-page space-y-10">
          <SectionHeading eyebrow="Compare" title={<>Side-by-side <Em>rate card</Em></>} subtitle="Per-kilometre AC rates by vehicle, with driver bata and airport base fares." />
          <RateTable fleet={fleet} caption="Taxi rates by vehicle" />
          <div>
            <h2 className="text-lg font-bold">Standard fare chart</h2>
            <p className="mt-1 text-sm text-muted-foreground">Base rates for our standard car; each vehicle above has its own per-km rate.</p>
            <div className="mt-4">
              <FareChart pricing={s.pricing} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
