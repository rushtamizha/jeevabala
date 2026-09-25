import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { FleetManager } from "@/components/admin/fleet-manager";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { requireAdminPage } from "@/lib/server/auth";
import { getSetting } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Vehicles & fares" };

export default async function FleetPage() {
  await requireAdminPage();
  const [rows, pricing] = await Promise.all([db.select().from(vehicles).orderBy(asc(vehicles.sortOrder), asc(vehicles.createdAt)), getSetting("pricing")]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">Vehicles & fares</h1>
        <p className="text-sm text-muted-foreground">Each vehicle has its own rate card on the website. Seats cap the passenger count at booking.</p>
      </div>
      <FleetManager
        pricing={pricing}
        vehicles={rows.map((v) => ({ id: v.id, slug: v.slug, category: v.category, name: v.name, model: v.model, description: v.description, seats: v.seats, luggage: v.luggage, plateNumber: v.plateNumber, color: v.color, features: v.features, hasAc: v.hasAc, priceMultiplier: v.priceMultiplier, rates: v.rates ?? {}, imageUrl: v.imageUrl, isActive: v.isActive, sortOrder: v.sortOrder }))}
      />
    </div>
  );
}
