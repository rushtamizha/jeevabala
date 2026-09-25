import { cn } from "cn";
import { BadgeCheckIcon, QuoteIcon, StarIcon } from "lucide-react";
import Image from "next/image";
import { Marquee } from "@/components/reactbits/marquee";
import { initials } from "@/lib/format";
import type { PublicTestimonial } from "@/lib/server/catalog";
import { Em, Section, SectionHeading } from "./sections";

function Stars({ rating, className = "size-3.5" }: { rating: number; className?: string }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} className={cn(className, i <= Math.round(rating) ? "fill-gold text-gold" : "fill-border text-border")} />
      ))}
    </span>
  );
}

/** Score, stars and distribution bars. */
export function RatingSummary({ reviews, className }: { reviews: PublicTestimonial[]; className?: string }) {
  if (!reviews.length) return null;
  const avg = reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.rating === n).length }));
  return (
    <div className={cn("flex items-center gap-5 rounded-2xl border bg-card p-4 sm:p-5", className)}>
      <div className="text-center">
        <p className="text-4xl font-bold leading-none tracking-tight tabular">{avg.toFixed(1)}</p>
        <div className="mt-2 flex justify-center"><Stars rating={avg} /></div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">{reviews.length} reviews</p>
      </div>
      <ul className="w-40 space-y-1.5" aria-label="Rating distribution">
        {dist.map(({ n, c }) => (
          <li key={n} className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="w-2 tabular">{n}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <span className="block h-full origin-left rounded-full bg-primary animate-grow-x" style={{ width: `${(c / reviews.length) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewCard({ r, className }: { r: PublicTestimonial; className?: string }) {
  return (
    <figure className={cn("flex h-full flex-col rounded-2xl border bg-card p-5 transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-premium", className)}>
      <div className="flex items-center justify-between">
        <Stars rating={r.rating} />
        <QuoteIcon aria-hidden className="size-5 fill-accent text-primary/40" />
      </div>
      <blockquote className="mt-3 line-clamp-4 flex-1 text-pretty text-sm leading-relaxed text-foreground/80">{r.text}</blockquote>
      <figcaption className="mt-5 flex items-center gap-3 border-t pt-4">
        <span className="relative shrink-0">
          {r.avatarUrl ? (
            <Image src={r.avatarUrl} alt="" width={40} height={40} className="size-10 rounded-full object-cover" />
          ) : (
            <span className="grid size-10 place-items-center rounded-full bg-foreground text-[13px] font-bold text-white">{initials(r.name)}</span>
          )}
          {r.verified && (
            <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-primary ring-2 ring-card">
              <BadgeCheckIcon className="size-3 text-white" aria-label="Verified trip" />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{r.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{[r.location, r.tripLabel].filter(Boolean).join(" · ") || "Rider"}</span>
        </span>
      </figcaption>
    </figure>
  );
}

/** Testimonials: two opposing marquee rows (pause on hover), or a grid when there are only a few. */
export function Testimonials({ reviews, tone = "light" }: { reviews: PublicTestimonial[]; tone?: "light" | "alt" }) {
  if (!reviews.length) return null;
  const rows = reviews.length >= 8 ? [reviews.filter((_, i) => i % 2 === 0), reviews.filter((_, i) => i % 2 === 1)] : [reviews];
  return (
    <Section id="reviews" tone={tone}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <SectionHeading eyebrow="Testimonials" title={<>Riders who keep <Em>coming back</Em></>} subtitle="Real feedback from verified trips and long-time customers." />
        <RatingSummary reviews={reviews} className="reveal w-full sm:w-auto" />
      </div>
      {reviews.length >= 4 ? (
        <div className="reveal mt-8 space-y-4">
          {rows.map((row, i) => (
            <Marquee key={i} reverse={i === 1} duration={Math.max(36, row.length * 9)} className="-mx-4 sm:mx-0">
              {row.map((r) => (
                <ReviewCard key={r.id} r={r} className="w-[300px] shrink-0 sm:w-[360px]" />
              ))}
            </Marquee>
          ))}
        </div>
      ) : (
        <div className="reveal-stagger mt-8 grid gap-4 md:grid-cols-3">
          {reviews.map((r) => (
            <ReviewCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </Section>
  );
}
