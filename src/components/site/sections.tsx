import { cn } from "cn";
import { ArrowRightIcon, PhoneCallIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { WhatsAppIcon } from "@/components/shared/icons";
import { formatINR, formatRate, phoneDigits } from "@/lib/format";
import type { ContentSettings, PricingSettings } from "@/lib/settings-schema";

/** One section band: consistent rhythm (`.section`) and container on every page. */
export function Section({
  id,
  tone = "light",
  className,
  containerClassName,
  children,
}: {
  id?: string;
  tone?: "light" | "alt" | "night";
  className?: string;
  containerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("section", tone === "alt" && "section-alt", tone === "night" && "section-night", className)}>
      <div className={cn("container-page", containerClassName)}>{children}</div>
    </section>
  );
}

/** Section header: eyebrow pill, bold title (orange highlight words), grey subtitle, optional "See all". */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
  align = "left",
  tone = "light",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: string;
  action?: { href: string; label: string };
  align?: "left" | "center";
  tone?: "light" | "night";
  className?: string;
}) {
  return (
    <div className={cn("reveal flex flex-wrap items-end justify-between gap-x-8 gap-y-4", align === "center" && "flex-col items-center text-center", className)}>
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && <span className={cn("eyebrow", tone === "night" && "eyebrow-dark")}>{eyebrow}</span>}
        <h2 className={cn("mt-3 text-[1.625rem] font-bold leading-[1.15] tracking-[-0.03em] sm:text-3xl lg:text-[2.125rem]", tone === "night" && "text-white")}>{title}</h2>
        {subtitle && <p className={cn("mt-2.5 text-pretty text-[15px] leading-relaxed", tone === "night" ? "text-white/65" : "text-muted-foreground")}>{subtitle}</p>}
      </div>
      {action && (
        <Link href={action.href} className="group inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border bg-card px-4 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary">
          {action.label} <ArrowRightIcon className="size-4 text-primary transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

/** Orange emphasis for key words inside headings. */
export function Em({ children }: { children: React.ReactNode }) {
  return <span className="font-display">{children}</span>;
}

/* ------------------------------------------------------------- Fare chart */

export function FareChart({ pricing }: { pricing: PricingSettings }) {
  const showAc = pricing.acMode !== "non-ac-only";
  const showNon = pricing.acMode !== "ac-only";
  const rows: { label: string; sub: string; ac: string; non: string }[] = [];
  if (pricing.oneWay.enabled)
    rows.push({ label: "One-way drop", sub: `Min ${pricing.oneWay.minKm} km · driver bata ${formatINR(pricing.oneWay.driverBata)}`, ac: `${formatRate(pricing.oneWay.acPerKm)}/km`, non: `${formatRate(pricing.oneWay.nonAcPerKm)}/km` });
  if (pricing.roundTrip.enabled)
    rows.push({ label: "Round trip", sub: `Min ${pricing.roundTrip.minKmPerDay} km/day · bata ${formatINR(pricing.roundTrip.driverBataPerDay)}/day`, ac: `${formatRate(pricing.roundTrip.acPerKm)}/km`, non: `${formatRate(pricing.roundTrip.nonAcPerKm)}/km` });
  if (pricing.airport.enabled)
    rows.push({ label: "Airport transfer", sub: `Base covers ${pricing.airport.baseKm} km, then per km`, ac: `${formatINR(pricing.airport.acBaseFare)} + ${formatRate(pricing.airport.acPerKm)}/km`, non: `${formatINR(pricing.airport.nonAcBaseFare)} + ${formatRate(pricing.airport.nonAcPerKm)}/km` });
  if (pricing.local.enabled)
    for (const p of pricing.local.packages) rows.push({ label: `Local · ${p.label}`, sub: `Extra ${formatRate(pricing.local.acExtraPerKm)}/km · ${formatINR(pricing.local.extraPerHour)}/hr`, ac: formatINR(p.acPrice), non: formatINR(p.nonAcPrice) });

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-2 border-b bg-secondary px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:px-6">
        <span>Trip</span>
        <span className={cn("text-right", !showAc && "invisible")}>AC</span>
        <span className={cn("text-right", !showNon && "invisible")}>Non-AC</span>
      </div>
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[1.6fr_1fr_1fr] items-center gap-2 px-4 py-3.5 sm:px-6">
            <div>
              <p className="text-sm font-semibold">{r.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.sub}</p>
            </div>
            <p className={cn("text-right text-sm font-bold tabular", !showAc && "invisible")}>{r.ac}</p>
            <p className={cn("text-right text-sm font-bold tabular", !showNon && "invisible")}>{r.non}</p>
          </li>
        ))}
      </ul>
      {(pricing.notes.length > 0 || (pricing.nightCharge.enabled && pricing.nightCharge.percent > 0)) && (
        <div className="space-y-1 border-t bg-secondary px-4 py-3.5 text-xs text-muted-foreground sm:px-6">
          {pricing.nightCharge.enabled && pricing.nightCharge.percent > 0 && (
            <p>Night charge of {pricing.nightCharge.percent}% applies for pickups between {pricing.nightCharge.startHour}:00 and {pricing.nightCharge.endHour}:00.</p>
          )}
          {pricing.notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- FAQ */

/**
 * Exclusive accordion built on native <details name>: zero JavaScript, content
 * stays in the HTML for the FAQPage schema, and the height animates where the
 * browser supports `::details-content`.
 */
export function Faq({
  faqs,
  title,
  subtitle,
  phone,
  whatsapp,
  tone = "light",
}: {
  faqs: ContentSettings["faqs"];
  title?: React.ReactNode;
  subtitle?: string;
  phone?: string;
  whatsapp?: string;
  tone?: "light" | "alt";
}) {
  if (!faqs.length) return null;
  return (
    <Section id="faq" tone={tone} containerClassName="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
      <div className="self-start lg:sticky lg:top-28">
        <SectionHeading
          eyebrow="FAQ"
          title={title ?? <>Questions, <Em>answered</Em></>}
          subtitle={subtitle ?? "Fares, bookings, payments and safety — everything riders ask before their first trip."}
        />
        {(phone || whatsapp) && (
          <div className="reveal mt-6 hidden gap-2.5 sm:grid">
            {phone && (
              <a href={`tel:${phone}`} className="group flex items-center gap-3.5 rounded-2xl border bg-card p-3.5 transition-colors hover:border-primary/40">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary"><PhoneCallIcon className="size-[18px]" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Call 24×7</span>
                  <span className="block truncate text-sm font-bold">{phone}</span>
                </span>
                <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </a>
            )}
            {whatsapp && (
              <a href={`https://wa.me/${phoneDigits(whatsapp)}`} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3.5 rounded-2xl border bg-card p-3.5 transition-colors hover:border-primary/40">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#25D366]/10 text-[#1a9e4b]"><WhatsAppIcon className="size-[18px]" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">WhatsApp</span>
                  <span className="block truncate text-sm font-bold">Replies within minutes</span>
                </span>
                <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </a>
            )}
          </div>
        )}
      </div>
      <div className="reveal-stagger space-y-2.5">
        {faqs.map((f, i) => (
          <details key={f.q} name="faq" open={i === 0} className="faq-item group rounded-2xl border bg-card transition-[border-color,box-shadow] duration-300 open:border-primary/30 open:shadow-premium">
            <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold transition-colors hover:text-primary group-open:text-primary">
              {f.q}
              <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground transition-[transform,translate,scale,background-color,color] duration-300 group-open:rotate-45 group-open:bg-primary group-open:text-primary-foreground">
                <PlusIcon className="size-4" />
              </span>
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
