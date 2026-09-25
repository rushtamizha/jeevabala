import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cities, travelRoutes } from "@/db/schema";

/** Rendered at request time so new city/route pages appear immediately. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();
  const [cityRows, routeRows] = await Promise.all([
    db.select({ slug: cities.slug, updatedAt: cities.updatedAt, featured: cities.isFeatured }).from(cities).where(eq(cities.isActive, true)),
    db.select({ slug: travelRoutes.slug, updatedAt: travelRoutes.updatedAt }).from(travelRoutes).where(eq(travelRoutes.isActive, true)),
  ]).catch(() => [[], []] as const);
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/book`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/vehicles`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/cities`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/routes`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...cityRows.map((c) => ({ url: `${base}/${c.slug}-taxi`, lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: c.featured ? 0.9 : 0.7 })),
    ...routeRows.map((r) => ({ url: `${base}/${r.slug}-taxi`, lastModified: r.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/cancellation-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
