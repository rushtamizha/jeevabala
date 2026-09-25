import { SiteBottomNav } from "@/components/site/bottom-nav";
import { FloatingContact } from "@/components/site/floating-contact";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader, type NavData } from "@/components/site/site-header";
import { getCustomerSession } from "@/lib/server/auth";
import { getCities, getFleet, getRoutes } from "@/lib/server/catalog";
import { getSetting } from "@/lib/server/settings";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [business, session, fleet, cities, routes] = await Promise.all([getSetting("business"), getCustomerSession(), getFleet(), getCities(), getRoutes()]);
  const nav: NavData = {
    vehicles: fleet.map((v) => ({ id: v.id, name: v.name, slug: v.slug, seats: v.seats, category: v.category, fromPerKm: v.rateCard.oneWay.ac })),
    cities: cities.filter((c) => c.isFeatured).concat(cities.filter((c) => !c.isFeatured)).map((c) => ({ name: c.name, slug: c.slug, state: c.state, district: c.district, featured: c.isFeatured })),
    routes: routes.map((r) => ({ slug: r.slug, fromName: r.fromName, toName: r.toName, distanceKm: r.distanceKm })),
  };
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <SiteHeader brand={business.name} slogan="Outstation · Airport · Local" customerName={session?.customer.name ?? null} phone={business.phone || undefined} nav={nav} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter business={business} cities={cities.filter((c) => c.isFeatured).slice(0, 12)} totalCities={cities.length} routes={nav.routes.slice(0, 12)} />
      <FloatingContact phone={business.phone || undefined} whatsapp={business.whatsapp || business.phone || undefined} brand={business.name} />
      <SiteBottomNav signedIn={Boolean(session)} />
    </>
  );
}
