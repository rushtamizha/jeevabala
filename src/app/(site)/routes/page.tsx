import type { Metadata } from "next";
import { RouteCard } from "@/components/site/home-sections";
import { JsonLd } from "@/components/site/json-ld";
import { PageHeader } from "@/components/site/page-header";
import { Em } from "@/components/site/sections";
import { faresForDistance, getActiveVehicleRows, getRoutes } from "@/lib/server/catalog";
import { absoluteUrl } from "@/lib/server/env";
import { getSettings } from "@/lib/server/settings";
import { metaDescription, seoTitle } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [routes, s] = await Promise.all([getRoutes(), getSettings()]);
  const title = seoTitle("Popular Outstation Taxi Routes & Fares", s.business.name);
  const description = metaDescription(
    `One-way and round-trip taxi fares for ${routes.length} popular routes, including ${routes.slice(0, 3).map((r) => `${r.fromName} to ${r.toName}`).join(", ")}. Verified driver, no surge.`,
  );
  const url = absoluteUrl("/routes");
  return { title, description, alternates: { canonical: url }, openGraph: { title: title.absolute, description, url }, twitter: { card: "summary_large_image", title: title.absolute, description } };
}

export default async function RoutesPage() {
  const [routes, s, vehicleRows] = await Promise.all([getRoutes(), getSettings(), getActiveVehicleRows()]);
  const byOrigin = new Map<string, typeof routes>();
  for (const r of routes) byOrigin.set(r.fromName, [...(byOrigin.get(r.fromName) ?? []), r]);
  const teaser = (r: (typeof routes)[number]) => {
    const f = faresForDistance(s.pricing, vehicleRows, r.distanceKm, r.durationMin);
    return { slug: r.slug, fromName: r.fromName, toName: r.toName, distanceKm: r.distanceKm, durationMin: r.durationMin, from: f.length ? Math.min(...f.map((x) => x.oneWay)) : 0 };
  };
  const crumbs = [
    { href: "/", label: "Home" },
    { href: "/routes", label: "Routes" },
  ];
  const ld = [
    { "@context": "https://schema.org", "@type": "ItemList", itemListElement: routes.map((r, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(`/${r.slug}-taxi`), name: `${r.fromName} to ${r.toName} taxi` })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: absoluteUrl(c.href) })) },
  ];
  return (
    <>
      <JsonLd data={ld} />
      <PageHeader
        crumbs={crumbs}
        eyebrow="Outstation"
        title={<>Popular routes & <Em>fares</Em></>}
        subtitle={`Indicative one-way fares for our most affordable car across ${routes.length} routes. Open a route to compare every vehicle, including round trips.`}
        points={["Driver bata included", "Tolls & parking as actuals", "One-way drop, no return fare"]}
      />
      {[...byOrigin.entries()].map(([from, list]) => (
        <section key={from} id={`from-${from.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="container-page scroll-mt-24 pb-10 sm:pb-12">
          <h2 className="text-xl font-bold">
            From <Em>{from}</Em> <span className="text-sm font-medium text-muted-foreground">· {list.length} route{list.length === 1 ? "" : "s"}</span>
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((r) => (
              <RouteCard key={r.id} r={teaser(r)} />
            ))}
          </div>
        </section>
      ))}
      <div className="h-6 sm:h-8" />
    </>
  );
}
