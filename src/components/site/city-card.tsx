import { cn } from "cn";
import { ArrowUpRightIcon, PlaneIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cityArt, cityTheme, THEME_LABEL } from "@/lib/city-meta";

export type CityCardData = { slug: string; name: string; district: string | null; state: string; imageUrl?: string | null; airportName?: string | null };

/** City artwork: the admin-uploaded photo if there is one, otherwise the themed illustration. */
export function CityArt({ city, sizes, className, index }: { city: CityCardData; sizes: string; className?: string; index?: number }) {
  const art = cityArt(city.slug, index);
  return city.imageUrl ? (
    <Image src={city.imageUrl} alt="" fill sizes={sizes} className={cn("object-cover", className)} />
  ) : (
    <Image src={art.src} alt="" fill unoptimized sizes={sizes} className={cn("object-cover", className)} style={art.flip ? { transform: "scaleX(-1)" } : undefined} />
  );
}

/** Image-led city card: artwork, a theme chip, "{City} taxi" and the district. */
export function CityCard({ city, className, priceLabel, index }: { city: CityCardData; className?: string; priceLabel?: string; index?: number }) {
  const theme = cityTheme(city.slug);
  return (
    <Link
      href={`/${city.slug}-taxi`}
      data-city={city.name.toLowerCase()}
      className={cn("group relative isolate flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-2xl bg-night p-4 text-white ring-1 ring-black/5 transition-[box-shadow,translate] duration-300 hover:-translate-y-1 hover:shadow-float", className)}
    >
      <CityArt city={city} index={index} sizes="(min-width: 1024px) 300px, (min-width: 640px) 33vw, 50vw" className="-z-20 transition-[scale] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]" />
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/35 to-transparent" />
      <span className="absolute left-3 top-3 inline-flex h-6 items-center gap-1 rounded-full bg-white/90 px-2.5 text-[10.5px] font-semibold text-foreground shadow-sm backdrop-blur">
        {city.airportName ? (
          <>
            <PlaneIcon className="size-3 text-primary" /> Airport
          </>
        ) : (
          THEME_LABEL[theme].split(" ")[0]
        )}
      </span>
      <span className="flex items-end justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-base font-bold leading-tight sm:text-[17px]">{city.name} taxi</span>
          <span className="mt-0.5 block truncate text-xs text-white/70">{priceLabel ?? (city.district && city.district !== city.name ? `${city.district} district` : city.state)}</span>
        </span>
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur transition-colors group-hover:bg-primary">
          <ArrowUpRightIcon className="size-4 transition-transform duration-300 group-hover:rotate-45" />
        </span>
      </span>
    </Link>
  );
}

/** Compact thumbnail chip (footer, "nearby" lists): artwork square + name. */
export function CityChip({ city, index }: { city: CityCardData; index?: number }) {
  return (
    <Link href={`/${city.slug}-taxi`} className="group flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-1.5 pr-3 transition-colors hover:border-primary/60 hover:bg-white/[0.08]">
      <span className="relative size-9 shrink-0 overflow-hidden rounded-lg">
        <CityArt city={city} index={index} sizes="36px" />
      </span>
      <span className="min-w-0 truncate text-[13px] font-medium text-white/80 group-hover:text-white">{city.name} taxi</span>
    </Link>
  );
}
