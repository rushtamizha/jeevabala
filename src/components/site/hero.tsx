import { BadgeCheckIcon, PhoneCallIcon, ShieldCheckIcon, StarIcon } from "lucide-react";
import Image from "next/image";
import { BookingWidget } from "@/components/booking/booking-widget";
import type { BookingConfig, BookingPrefill } from "@/components/booking/types";
import { Marquee } from "@/components/reactbits/marquee";
import { WhatsAppIcon } from "@/components/shared/icons";
import { phoneDigits } from "@/lib/format";

type Props = {
  config: BookingConfig;
  prefill?: BookingPrefill;
  title: string;
  highlight: string;
  subtitle: string;
  city: string;
  region: string;
  announcement?: string;
  eyebrow?: string;
  images: string[];
  experienceYears: number;
  stats: { completedRides: number; avgRating: number | null; reviewCount: number };
  phone?: string;
  whatsapp?: string;
};

const HIGHLIGHTS = [
  "24×7 availability",
  "Transparent, itemised fares",
  "No surge pricing",
  "Background-verified driver",
  "Clean, sanitised cars",
  "Ride PIN for every trip",
  "Pay after the ride",
  "Free cancellation",
  "Airport flight tracking",
  "Outstation specialists",
];

/**
 * Home hero + booking. A Server Component: only the booking widget hydrates.
 * LCP-first — the heading is painted at full opacity on the first frame, the
 * first background photo is preloaded, and extra photos crossfade in CSS.
 */
export function Hero({ config, prefill, title, highlight, subtitle, city, region, announcement, eyebrow, images, experienceYears, stats, phone, whatsapp }: Props) {
  const slides = images.slice(0, 4);
  const ratingOk = stats.avgRating !== null && stats.reviewCount >= 3;
  const facts = [
    { icon: BadgeCheckIcon, value: `${experienceYears}+ yrs`, label: "On the road" },
    ratingOk
      ? { icon: StarIcon, value: `${stats.avgRating?.toFixed(1)}/5`, label: `${stats.reviewCount} reviews` }
      : { icon: ShieldCheckIcon, value: "100%", label: "Verified driver" },
    stats.completedRides >= 10 ? { icon: BadgeCheckIcon, value: `${stats.completedRides}+`, label: "Rides completed" } : { icon: PhoneCallIcon, value: "24×7", label: "Always available" },
  ];

  return (
    <section id="book" className="relative isolate -mt-[76px] overflow-hidden bg-night text-white">
      {/* Background: optional photo crossfade → night gradient → grid → halftone dots */}
      <div aria-hidden className="absolute inset-0 -z-10">
        {slides.length > 0 && (
          <div className="hero-slides absolute inset-0" data-n={slides.length}>
            {slides.map((src, i) => (
              <div key={src} className="hero-slide absolute inset-0" style={{ ["--i" as string]: i }}>
                <Image src={src} alt="" fill preload={i === 0} sizes="100vw" quality={70} className="object-cover" />
              </div>
            ))}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-night via-night/92 to-night/75" />
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/20 to-night/70" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_85%_60%,rgb(251_91_33/0.22),transparent_70%)]" />
        <div className="absolute inset-0 bg-grid-dark [mask-image:radial-gradient(ellipse_70%_60%_at_30%_40%,black,transparent)]" />
      </div>

      <div className="container-page grid grid-cols-[minmax(0,1fr)] gap-8 pb-12 pt-[108px] lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-0 lg:pb-16 lg:pt-[132px]">
        {/* Copy — top half (always before the widget) */}
        <div className="min-w-0 animate-lift lg:self-end">
          <span className="inline-flex h-8 items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] pl-2.5 pr-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/85 backdrop-blur-md">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-primary opacity-70 animate-ping-slow" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            <span className="truncate">{announcement || eyebrow || `Now booking across ${city} & beyond`}</span>
          </span>
          <h1 className="mt-5 text-balance text-[2.5rem] font-bold leading-[1.04] tracking-[-0.04em] sm:text-[3.25rem] xl:text-[3.75rem]">
            {title} <span className="text-primary">{highlight}</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-white/70 sm:text-[17px]">
            {subtitle} Based in <span className="font-semibold text-white">{city}, {region}</span>.
          </p>
        </div>

        {/* Booking widget — right column on desktop, straight after the headline on phones */}
        <div id="booking-card" className="min-w-0 scroll-mt-24 animate-lift [animation-delay:60ms] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
          <BookingWidget config={config} prefill={prefill} />
        </div>

        {/* Copy — bottom half: contact + proof */}
        <div className="min-w-0 animate-lift [animation-delay:120ms] lg:col-start-1 lg:row-start-2 lg:self-start lg:pt-8">
          {(phone || whatsapp) && (
            <div className="mb-6 flex flex-wrap items-center gap-2.5">
            {phone && (
              <a href={`tel:${phone}`} className="inline-flex h-12 items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] px-5 text-sm font-semibold backdrop-blur-md transition-colors hover:bg-white/[0.12]">
                <PhoneCallIcon className="size-4 text-primary" /> Call 24×7
              </a>
            )}
            {whatsapp && (
              <a href={`https://wa.me/${phoneDigits(whatsapp)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] px-5 text-sm font-semibold backdrop-blur-md transition-colors hover:bg-white/[0.12]">
                <WhatsAppIcon className="size-4 text-[#25D366]" /> WhatsApp
              </a>
            )}
            </div>
          )}
          <dl className="grid max-w-lg grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.04] py-4 backdrop-blur-md">
            {facts.map((f) => (
              <div key={f.label} className="flex flex-col-reverse px-3 sm:px-5">
                <dt className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-white/55">
                  <f.icon className="hidden size-3.5 shrink-0 text-primary sm:block" /> {f.label}
                </dt>
                <dd className="text-xl font-bold leading-none tracking-tight tabular sm:text-2xl">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="border-t border-white/10 bg-black/40 py-3.5">
        <Marquee duration={50}>
          {HIGHLIGHTS.map((h) => (
            <span key={h} className="inline-flex items-center gap-2.5 whitespace-nowrap px-4 text-[13px] font-medium text-white/70">
              <span className="size-1.5 rounded-full bg-primary" /> {h}
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
