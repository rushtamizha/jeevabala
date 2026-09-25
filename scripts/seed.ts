/** Seed defaults (idempotent): settings, fleet, SEO cities and popular routes. */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { eq, isNull, and } = await import("drizzle-orm");
  const { db, closeDb } = await import("../src/db");
  const { vehicles, settings, cities, travelRoutes } = await import("../src/db/schema");
  const { SETTINGS_SCHEMAS } = await import("../src/lib/settings-schema");
  const { SEED_VEHICLES, SEED_CITIES, SEED_ROUTES } = await import("../src/db/seed-data");

  for (const key of Object.keys(SETTINGS_SCHEMAS) as (keyof typeof SETTINGS_SCHEMAS)[]) {
    await db.insert(settings).values({ key, value: SETTINGS_SCHEMAS[key].parse({}) }).onConflictDoNothing();
  }
  console.log("✔ Default settings ensured");

  // Adopt the legacy un-slugged "Sedan" row from the first seed, if present.
  await db.update(vehicles).set({ slug: "sedan" }).where(and(isNull(vehicles.slug), eq(vehicles.name, "Sedan")));
  let added = 0;
  for (const v of SEED_VEHICLES) {
    const [existing] = await db.select({ id: vehicles.id, rates: vehicles.rates }).from(vehicles).where(eq(vehicles.slug, v.slug)).limit(1);
    if (existing) {
      if (Object.keys(existing.rates ?? {}).length === 0) {
        await db.update(vehicles).set({ rates: v.rates, category: v.category, description: v.description, model: v.model, luggage: v.luggage, features: v.features, sortOrder: v.sortOrder }).where(eq(vehicles.id, existing.id));
      }
      continue;
    }
    await db.insert(vehicles).values({ ...v, priceMultiplier: 100, isActive: true });
    added++;
  }
  console.log(`✔ Fleet ready (${added} vehicle${added === 1 ? "" : "s"} added)`);

  const cityIds = new Map<string, { id: string; name: string }>();
  for (const [i, c] of SEED_CITIES.entries()) {
    const [row] = await db
      .insert(cities)
      .values({ slug: c.slug, name: c.name, district: c.district, state: c.state, lat: c.lat, lng: c.lng, airportName: c.airportName ?? null, attractions: c.attractions, isFeatured: Boolean(c.featured), sortOrder: i })
      .onConflictDoNothing({ target: cities.slug })
      .returning({ id: cities.id, name: cities.name });
    const found = row ?? (await db.select({ id: cities.id, name: cities.name }).from(cities).where(eq(cities.slug, c.slug)).limit(1))[0];
    cityIds.set(c.slug, found);
  }
  console.log(`✔ ${SEED_CITIES.length} city pages ensured`);

  for (const [i, rt] of SEED_ROUTES.entries()) {
    const from = cityIds.get(rt.from);
    const to = cityIds.get(rt.to);
    if (!from || !to) continue;
    await db
      .insert(travelRoutes)
      .values({
        slug: `${rt.from}-to-${rt.to}`,
        fromName: from.name,
        toName: to.name,
        fromCityId: from.id,
        toCityId: to.id,
        distanceKm: rt.km,
        durationMin: Math.round((rt.km / 52) * 60),
        isFeatured: Boolean(rt.featured),
        sortOrder: i,
      })
      .onConflictDoNothing({ target: travelRoutes.slug });
  }
  console.log(`✔ ${SEED_ROUTES.length} route pages ensured`);
  await closeDb();
}

main().catch((err) => {
  console.error("✖ Seed failed:", err);
  process.exit(1);
});
