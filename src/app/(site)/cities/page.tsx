import type { Metadata } from "next";
import { CityCard } from "@/components/site/city-card";
import { CitySearch } from "@/components/site/city-search";
import { JsonLd } from "@/components/site/json-ld";
import { PageHeader } from "@/components/site/page-header";
import { Em } from "@/components/site/sections";
import { cityRegion, HILL_STATIONS, REGION_BLURB, REGION_LABEL, type CityRegion } from "@/lib/city-meta";
import { getCities } from "@/lib/server/catalog";
import { absoluteUrl } from "@/lib/server/env";
import { getSettings } from "@/lib/server/settings";
import { metaDescription, seoTitle } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [cities, s] = await Promise.all([getCities(), getSettings()]);
  const tn = cities.filter((c) => c.state === "Tamil Nadu").length;
  const title = seoTitle(`Taxi Service in ${tn}+ Tamil Nadu Cities – One Way, Outstation & Airport`, s.business.name);
  const description = metaDescription(
    `Book one-way drop taxis, outstation cabs and airport transfers in ${cities.length} cities — Chennai, Coimbatore, Madurai, Trichy, Salem, Tirunelveli, Ooty, Kodaikanal, every Tamil Nadu district and major town.`,
  );
  const url = absoluteUrl("/cities");
  return { title, description, alternates: { canonical: url }, openGraph: { title: title.absolute, description, url }, twitter: { card: "summary_large_image", title: title.absolute, description } };
}

const ORDER: CityRegion[] = ["north", "west", "central", "south", "other"];

export default async function CitiesPage() {
  const [cities, s] = await Promise.all([getCities(), getSettings()]);
  const tn = cities.filter((c) => c.state === "Tamil Nadu");
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const featured = cities.filter((c) => c.isFeatured).slice(0, 8);
  const hills = cities.filter((c) => HILL_STATIONS.has(c.slug)).sort(byName);
  const groups = ORDER.map((r) => ({ id: r, title: REGION_LABEL[r], blurb: REGION_BLURB[r], list: cities.filter((c) => cityRegion(c) === r).sort(byName) })).filter((g) => g.list.length);
  const crumbs = [
    { href: "/", label: "Home" },
    { href: "/cities", label: "Cities" },
  ];
  const ld = [
    { "@context": "https://schema.org", "@type": "ItemList", name: `${s.business.name} service cities`, numberOfItems: cities.length, itemListElement: cities.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(`/${c.slug}-taxi`), name: `${c.name} taxi` })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: absoluteUrl(c.href) })) },
  ];
  const section = (id: string, title: string, blurb: string, list: typeof cities) => (
    <section key={id} id={id} data-city-group className="scroll-mt-40 pt-8 first:pt-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {title} <span className="text-sm font-medium text-muted-foreground">· {list.length}</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
        </div>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {list.map((c, i) => (
          <li key={c.id}>
            <CityCard city={c} index={i} />
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <>
      <JsonLd data={ld} />
      <PageHeader
        crumbs={crumbs}
        eyebrow="Service area"
        title={<>Taxi service across <Em>Tamil Nadu</Em></>}
        subtitle={`${s.business.name} drives one-way drops, round trips, airport transfers and local hourly rides in ${tn.length} Tamil Nadu cities and towns — plus Bengaluru, Puducherry and Tirupati.`}
        points={["All 38 districts covered", "Hill-trained drivers", "24×7 airport pickups"]}
      >
        <nav aria-label="Regions" className="mt-6 flex flex-wrap gap-2">
          {groups.map((g) => (
            <a key={g.id} href={`#${g.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3.5 text-[13px] font-semibold transition-colors hover:border-primary/40 hover:text-primary">
              {g.title} <span className="text-xs font-medium text-muted-foreground">{g.list.length}</span>
            </a>
          ))}
          {hills.length > 0 && (
            <a href="#hill-stations" className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3.5 text-[13px] font-semibold transition-colors hover:border-primary/40 hover:text-primary">
              Hill stations <span className="text-xs font-medium text-muted-foreground">{hills.length}</span>
            </a>
          )}
        </nav>
      </PageHeader>
      <div className="container-page pb-16 pt-2">
        <CitySearch total={cities.length} />
        {featured.length > 0 && section("popular", "Most booked", "Our busiest pickup cities, with airport transfers and daily outstation departures.", featured)}
        {groups.map((g) => section(g.id, g.title, g.blurb, g.list))}
        {hills.length > 0 && section("hill-stations", "Hill stations", "Ghat-road specialists for Ooty, Kodaikanal, Yercaud, Valparai and more.", hills)}
      </div>
    </>
  );
}
