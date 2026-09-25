import { getCityBySlug, getFleet, getRouteBySlug, routeFares } from "@/lib/server/catalog";
import { OG_SIZE, ogCard } from "@/lib/server/og";
import { getSetting } from "@/lib/server/settings";
import { formatINR, formatRate } from "@/lib/format";

export const alt = "Taxi service and fares";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getSetting("business");
  const base = /^[a-z0-9-]{1,80}-taxi$/.test(slug) ? slug.slice(0, -5) : "";
  if (base.includes("-to-")) {
    const rt = await getRouteBySlug(base);
    if (rt) {
      const fares = await routeFares(rt);
      const from = fares.length ? Math.min(...fares.map((f) => f.oneWay)) : 0;
      return ogCard({ brand: b.name, title: `${rt.fromName} to ${rt.toName}`, highlight: "Taxi", subtitle: `${rt.distanceKm} km one-way drop from ${formatINR(from)}. Verified driver, no surge.`, chips: [`${rt.distanceKm} km`, `From ${formatINR(from)}`, "Pay after ride"] });
    }
  }
  const city = base ? await getCityBySlug(base) : null;
  const fleet = await getFleet();
  const min = fleet.length ? Math.min(...fleet.map((v) => v.rateCard.oneWay.ac)) : 0;
  return ogCard({
    brand: b.name,
    title: city ? city.name : b.name,
    highlight: "Taxi Service",
    subtitle: `One-way, round trip, airport & local cabs from ${formatRate(min)}/km.`,
    chips: [`From ${formatRate(min)}/km`, "Verified driver", "24×7"],
  });
}
