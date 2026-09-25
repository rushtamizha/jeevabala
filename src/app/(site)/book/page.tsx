import type { Metadata } from "next";
import { CheckIcon } from "lucide-react";
import { BookingWidget } from "@/components/booking/booking-widget";
import { Em } from "@/components/site/sections";
import { getCustomerSession } from "@/lib/server/auth";
import { getCityBySlug } from "@/lib/server/catalog";
import { absoluteUrl } from "@/lib/server/env";
import { signPlace } from "@/lib/server/geo";
import { getBookingConfig } from "@/lib/server/public-data";
import { TRIP_TYPES, type TripType } from "@/lib/types";

export const metadata: Metadata = {
  title: "Book a taxi online",
  description: "Get an instant, itemised taxi fare and book one-way, round trip, airport or local cabs in under a minute. Pay after your ride.",
  alternates: { canonical: absoluteUrl("/book") },
};

const SLUG = /^[a-z0-9-]{2,60}$/;

export default async function BookPage(props: PageProps<"/book">) {
  const sp = await props.searchParams;
  const session = await getCustomerSession();
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const [config, fromCity, toCity] = await Promise.all([
    getBookingConfig(session?.customer ?? null),
    str("from") && SLUG.test(str("from")!) ? getCityBySlug(str("from")!) : null,
    str("to") && SLUG.test(str("to")!) ? getCityBySlug(str("to")!) : null,
  ]);
  const trip = str("trip") && (TRIP_TYPES as readonly string[]).includes(str("trip")!) ? (str("trip") as TripType) : undefined;
  const ref = str("ref") && /^[A-Z0-9]{4,16}$/i.test(str("ref")!) ? str("ref")!.toUpperCase() : undefined;
  const promo = str("promo") && /^[A-Z0-9-]{3,24}$/i.test(str("promo")!) ? str("promo")!.toUpperCase() : undefined;
  const vehicle = str("vehicle") && /^[a-z0-9-]{2,64}$/.test(str("vehicle")!) ? str("vehicle") : undefined;
  const place = (c: NonNullable<typeof fromCity>) => signPlace({ label: `${c.name}, ${c.state}`, lat: c.lat, lng: c.lng });
  return (
    <section className="relative isolate overflow-hidden bg-screen">
      <div aria-hidden className="absolute inset-0 -z-10 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_60%_70%_at_20%_0%,black,transparent)]" />
      <div className="container-page grid grid-cols-[minmax(0,1fr)] gap-8 pb-14 pt-6 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-16 lg:pb-20">
        <div className="animate-lift lg:pt-6">
          <span className="eyebrow">Book a ride</span>
          <h1 className="mt-3 text-balance text-[2rem] font-bold leading-[1.08] tracking-[-0.035em] sm:text-[2.75rem]">
            Where are we <Em>heading?</Em>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">Get an exact, itemised fare in seconds. Nothing to pay until your trip is complete.</p>
          <ul className="mt-7 grid gap-2.5">
            {["Instant fare with full breakdown", "Confirmation by email & WhatsApp", "Private Ride PIN for a safe pickup", "Pay after the ride — UPI or cash", "Free cancellation before the driver starts"].map((t) => (
              <li key={t} className="flex items-center gap-3 text-sm font-medium">
                <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-success/10 text-success"><CheckIcon className="size-3.5" /></span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <BookingWidget
          config={config}
          prefill={{ tripType: trip, ref, promo, vehicleId: vehicle, pickup: fromCity ? place(fromCity) : undefined, drop: toCity ? place(toCity) : undefined }}
          variant="page"
        />
      </div>
    </section>
  );
}
