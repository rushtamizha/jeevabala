import type { Metadata } from "next";
import { asc, desc } from "drizzle-orm";
import { CityManager } from "@/components/admin/catalog-editors";
import { db } from "@/db";
import { cities } from "@/db/schema";
import { requireAdminPage } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Cities" };

export default async function AdminCitiesPage() {
  await requireAdminPage();
  const rows = await db.select().from(cities).orderBy(desc(cities.isFeatured), asc(cities.sortOrder), asc(cities.name));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">Cities</h1>
        <p className="text-sm text-muted-foreground">SEO landing pages like /coimbatore-taxi. Published cities appear in menus, the footer and the sitemap.</p>
      </div>
      <CityManager
        cities={rows.map((c) => ({ id: c.id, slug: c.slug, name: c.name, district: c.district, state: c.state, lat: c.lat, lng: c.lng, intro: c.intro, highlights: c.highlights, attractions: c.attractions, airportName: c.airportName, imageUrl: c.imageUrl, metaTitle: c.metaTitle, metaDescription: c.metaDescription, isActive: c.isActive, isFeatured: c.isFeatured, sortOrder: c.sortOrder }))}
      />
    </div>
  );
}
