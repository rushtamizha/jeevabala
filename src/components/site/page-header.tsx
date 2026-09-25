import { CheckIcon, ChevronRightIcon, HouseIcon } from "lucide-react";
import Link from "next/link";

/** Inner-page header: soft grey → white fade, breadcrumb, eyebrow, bold title. Painted immediately (no entrance fade). */
export function PageHeader({
  crumbs,
  eyebrow,
  title,
  subtitle,
  points,
  children,
}: {
  crumbs: { href: string; label: string }[];
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: string;
  points?: string[];
  children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-screen">
      <div aria-hidden className="absolute inset-0 -z-10 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_60%_80%_at_80%_0%,black,transparent)]" />
      <div className="container-page pb-8 pt-6 sm:pb-10 sm:pt-10">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-xs font-medium text-muted-foreground">
            {crumbs.map((c, i) => (
              <li key={c.href} className="flex items-center gap-1">
                {i > 0 && <ChevronRightIcon aria-hidden className="size-3" />}
                {i < crumbs.length - 1 ? (
                  <Link href={c.href} className="inline-flex items-center gap-1 transition-colors hover:text-primary">
                    {i === 0 && <HouseIcon aria-hidden className="size-3" />} {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-foreground">{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <div className="animate-lift">
          {eyebrow && <span className="eyebrow mt-6">{eyebrow}</span>}
          <h1 className="mt-3 max-w-3xl text-balance text-[2rem] font-bold leading-[1.08] tracking-[-0.035em] sm:text-[2.75rem]">{title}</h1>
          {subtitle && <p className="mt-3 max-w-2xl text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-base">{subtitle}</p>}
          {points && points.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {points.map((x) => (
                <li key={x} className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium">
                  <CheckIcon className="size-3.5 text-success" /> {x}
                </li>
              ))}
            </ul>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
