import { ChevronRightIcon, HouseIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BookingWidget } from "@/components/booking/booking-widget";
import type { BookingConfig, BookingPrefill } from "@/components/booking/types";

/** Hero for city & route landing pages — same night language and LCP rules as the home hero. */
export function SeoHero({
  crumbs,
  title,
  highlight,
  subtitle,
  chips,
  imageUrl,
  config,
  prefill,
}: {
  crumbs: { href: string; label: string }[];
  title: string;
  highlight?: string;
  subtitle: string;
  chips: string[];
  imageUrl?: string | null;
  config: BookingConfig;
  prefill?: BookingPrefill;
}) {
  return (
    <section id="book" className="relative isolate -mt-[76px] scroll-mt-0 overflow-hidden bg-night text-white">
      <div aria-hidden className="absolute inset-0 -z-10">
        {imageUrl && <Image src={imageUrl} alt="" fill preload sizes="100vw" quality={70} className="object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-r from-night via-night/90 to-night/55" />
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/20 to-night/70" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_85%_60%,rgb(251_91_33/0.22),transparent_70%)]" />
        <div className="absolute inset-0 bg-grid-dark [mask-image:radial-gradient(ellipse_70%_60%_at_30%_40%,black,transparent)]" />
      </div>
      <div className="container-page grid grid-cols-[minmax(0,1fr)] items-center gap-8 pb-12 pt-[104px] lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-16 lg:pb-16 lg:pt-[128px]">
        <div className="min-w-0 animate-lift">
          <nav aria-label="Breadcrumb">
            <ol className="inline-flex flex-wrap items-center gap-1 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/75 backdrop-blur-md">
              {crumbs.map((c, i) => (
                <li key={c.href} className="flex items-center gap-1">
                  {i > 0 && <ChevronRightIcon aria-hidden className="size-3 text-white/40" />}
                  {i < crumbs.length - 1 ? (
                    <Link href={c.href} className="inline-flex items-center gap-1 transition-colors hover:text-white">
                      {i === 0 && <HouseIcon aria-hidden className="size-3 text-primary" />} {c.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-white">{c.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <h1 className="mt-5 text-balance text-[2.5rem] font-bold leading-[1.04] tracking-[-0.04em] sm:text-[3.25rem]">
            {title}
            {highlight && <span className="text-primary"> {highlight}</span>}
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-white/70 sm:text-[17px]">{subtitle}</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {chips.map((c) => (
              <li key={c} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 text-xs font-semibold backdrop-blur-md">
                <span className="size-1.5 rounded-full bg-primary" /> {c}
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 animate-lift [animation-delay:60ms]">
          <BookingWidget config={config} prefill={prefill} />
        </div>
      </div>
    </section>
  );
}
