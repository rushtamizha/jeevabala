import type { Metadata } from "next";
import { asc, desc } from "drizzle-orm";
import { RouteManager } from "@/components/admin/catalog-editors";
import { db } from "@/db";
import { cities, travelRoutes } from "@/db/schema";
import { requireAdminPage } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Routes" };

export default async function AdminRoutesPage() {
  await requireAdminPage();
  const [rows, cityRows] = await Promise.all([
    db.select().from(travelRoutes).orderBy(desc(travelRoutes.isFeatured), asc(travelRoutes.sortOrder), asc(travelRoutes.fromName)),
    db.select({ id: cities.id, name: cities.name, slug: cities.slug }).from(cities).orderBy(asc(cities.name)),
  ]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">Routes</h1>
        <p className="text-sm text-muted-foreground">City-to-city pages like /chennai-to-bengaluru-taxi, with fares for every vehicle.</p>
      </div>
      <RouteManager
        cities={cityRows}
        routes={rows.map((r) => ({ id: r.id, slug: r.slug, fromName: r.fromName, toName: r.toName, fromCityId: r.fromCityId, toCityId: r.toCityId, distanceKm: r.distanceKm, durationMin: r.durationMin, description: r.description, highlights: r.highlights, metaTitle: r.metaTitle, metaDescription: r.metaDescription, isActive: r.isActive, isFeatured: r.isFeatured, sortOrder: r.sortOrder }))}
      />
    </div>
  );
}
