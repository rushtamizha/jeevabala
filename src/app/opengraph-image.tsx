import { getSetting } from "@/lib/server/settings";
import { OG_SIZE, ogCard } from "@/lib/server/og";

export const alt = "Outstation, airport and local taxi booking";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image() {
  const b = await getSetting("business").catch(() => null);
  return ogCard({
    brand: b?.name ?? "Saarathi Cabs",
    title: "Your personal",
    highlight: "chauffeur.",
    subtitle: "One-way drops, round trips, airport & local rides with a verified driver.",
    chips: ["No surge", "Pay after ride", "24×7"],
  });
}
