import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { TestimonialManager } from "@/components/admin/catalog-editors";
import { db } from "@/db";
import { testimonials } from "@/db/schema";
import { requireAdminPage } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Testimonials" };

export default async function AdminTestimonialsPage() {
  await requireAdminPage();
  const rows = await db.select().from(testimonials).orderBy(asc(testimonials.sortOrder), asc(testimonials.createdAt));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">Testimonials</h1>
        <p className="text-sm text-muted-foreground">Curated quotes shown alongside verified trip reviews on the home page.</p>
      </div>
      <TestimonialManager items={rows.map((t) => ({ id: t.id, name: t.name, location: t.location, rating: t.rating, text: t.text, avatarUrl: t.avatarUrl, tripLabel: t.tripLabel, source: t.source, isActive: t.isActive, sortOrder: t.sortOrder }))} />
    </div>
  );
}
