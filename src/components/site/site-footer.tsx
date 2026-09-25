import { ArrowRightIcon, ArrowUpRightIcon, MailIcon, MapPinIcon, PhoneIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { CityChip, type CityCardData } from "./city-card";
import { FacebookIcon, InstagramIcon, WhatsAppIcon, XIcon, YouTubeIcon } from "@/components/shared/icons";
import { phoneDigits } from "@/lib/format";
import type { BusinessSettings } from "@/lib/settings-schema";

const HEADING = "text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45";
const PILL = "inline-flex h-8 items-center rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-white/70 transition-colors hover:border-primary hover:bg-primary hover:text-white";

function FooterLinks({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <nav aria-label={title}>
      <h3 className={HEADING}>{title}</h3>
      <ul className="mt-4 space-y-1">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="group inline-flex items-center gap-1 py-1 text-sm text-white/70 transition-colors hover:text-white">
              {l.label}
              <ArrowUpRightIcon className="size-3.5 -translate-x-1 text-primary opacity-0 transition-[opacity,transform,translate,scale] group-hover:translate-x-0 group-hover:opacity-100" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Dark footer: brand, links, contact, then image chips for the most-booked cities and popular routes. */
export function SiteFooter({ business, cities = [], totalCities, routes = [] }: { business: BusinessSettings; cities?: CityCardData[]; totalCities?: number; routes?: { slug: string; fromName: string; toName: string }[] }) {
  const socials = [
    { href: business.social.instagram, label: "Instagram", Icon: InstagramIcon },
    { href: business.social.facebook, label: "Facebook", Icon: FacebookIcon },
    { href: business.social.youtube, label: "YouTube", Icon: YouTubeIcon },
    { href: business.social.x, label: "X", Icon: XIcon },
  ].filter((s) => s.href);
  const wa = business.whatsapp || business.phone;
  const contact = [
    business.phone && { href: `tel:${business.phone}`, icon: PhoneIcon, label: business.phone, external: false },
    wa && { href: `https://wa.me/${phoneDigits(wa)}`, icon: WhatsAppIcon, label: "WhatsApp us", external: true },
    business.email && { href: `mailto:${business.email}`, icon: MailIcon, label: business.email, external: false },
  ].filter(Boolean) as { href: string; icon: typeof PhoneIcon; label: string; external: boolean }[];

  return (
    <footer className="no-print relative isolate mt-auto overflow-hidden bg-night pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-white md:pb-0">
      <div aria-hidden className="absolute -top-48 left-1/2 -z-10 h-96 w-[70%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(251_91_33/0.16),transparent)]" />

      <div className="container-page grid gap-10 pb-10 pt-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.3fr] lg:gap-8 lg:pt-16">
        <div className="space-y-5">
          <Logo name={business.name} tone="inverse" />
          <p className="max-w-xs text-sm leading-relaxed text-white/60">{business.tagline}</p>
          <p className="inline-flex h-7 items-center gap-1.5 rounded-full bg-success/12 px-3 text-xs font-medium text-[#4ade80]">
            <ShieldCheckIcon className="size-3.5" /> Verified driver · Secure bookings
          </p>
          {socials.length > 0 && (
            <div className="flex gap-2">
              {socials.map(({ href, label, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/75 transition-colors hover:border-primary hover:bg-primary hover:text-white">
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          )}
        </div>
        <FooterLinks
          title="Ride"
          links={[
            { href: "/book", label: "Book a ride" },
            { href: "/vehicles", label: "Vehicles & fares" },
            { href: "/routes", label: "Popular routes" },
            { href: "/cities", label: "Cities we serve" },
            { href: "/account", label: "My rides" },
            { href: "/#rewards", label: "Rewards & referrals" },
          ]}
        />
        <FooterLinks
          title="Company"
          links={[
            { href: "/#faq", label: "FAQ" },
            { href: "/privacy", label: "Privacy policy" },
            { href: "/terms", label: "Terms of service" },
            { href: "/cancellation-policy", label: "Cancellation & refunds" },
          ]}
        />
        <div>
          <h3 className={HEADING}>Contact</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {contact.map((c) => (
              <li key={c.href}>
                <a href={c.href} {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="group flex min-w-0 items-center gap-3 text-white/80 transition-colors hover:text-white">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-primary transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-white">
                    <c.icon className="size-4" />
                  </span>
                  <span className="truncate">{c.label}</span>
                </a>
              </li>
            ))}
            <li className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-primary"><MapPinIcon className="size-4" /></span>
              <span className="pt-2 text-white/60">{business.address || `${business.city}, ${business.region}`}</span>
            </li>
          </ul>
        </div>
      </div>

      {(cities.length > 0 || routes.length > 0) && (
        <div className="container-page grid gap-8 border-t border-white/10 py-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
          {cities.length > 0 && (
            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className={HEADING}>Taxi service in</h3>
                <Link href="/cities" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  All {totalCities ?? cities.length} cities <ArrowRightIcon className="size-3.5" />
                </Link>
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {cities.map((c, i) => (
                  <li key={c.slug}>
                    <CityChip city={c} index={i} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {routes.length > 0 && (
            <div>
              <h3 className={HEADING}>Popular routes</h3>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {routes.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/${r.slug}-taxi`} className={PILL}>{r.fromName} to {r.toName}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-white/55 sm:flex-row">
          <p>© {new Date().getFullYear()} {business.name}. All rights reserved.{business.gstin ? ` · GSTIN ${business.gstin}` : ""}</p>
          <p>Serving {business.city} & beyond · 24×7</p>
        </div>
      </div>
    </footer>
  );
}
