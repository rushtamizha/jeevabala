import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { RoadLights } from "@/components/reactbits/road-lights";

/**
 * Split-screen shell for sign-in flows (customer and admin). The night panel
 * runs the RoadLights canvas; on phones it collapses to an animated band the
 * form card overlaps. No site navigation — nothing to distract or leak.
 */
export function AuthShell({
  brand,
  eyebrow,
  title,
  highlight,
  points,
  footnote,
  backHref = "/",
  backLabel = "Back to site",
  children,
}: {
  brand: string;
  eyebrow: string;
  title: string;
  highlight: string;
  points: { icon: React.ReactNode; title: string; text: string }[];
  footnote?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh bg-night lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:bg-white">
      <aside className="relative isolate flex h-60 flex-col overflow-hidden bg-night text-white sm:h-64 lg:h-auto">
        <RoadLights className="-z-20" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-night/70 via-transparent to-night/60 lg:via-night/10 lg:to-night" />
        <div aria-hidden className="absolute -left-40 -top-40 -z-10 size-[36rem] rounded-full bg-[radial-gradient(circle,rgb(251_91_33/0.2),transparent_65%)]" />

        <div className="flex items-center justify-between p-5 sm:p-8 xl:p-12">
          <Link href="/" aria-label={`${brand} home`}>
            <Logo name={brand} tone="inverse" />
          </Link>
          <Link href={backHref} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3.5 text-xs font-semibold text-white/80 backdrop-blur-md transition-colors hover:bg-white/[0.12] hover:text-white lg:hidden">
            <ArrowLeftIcon className="size-3.5" /> {backLabel}
          </Link>
        </div>

        <div className="mt-auto hidden max-w-lg p-8 lg:block xl:p-12">
          <span className="eyebrow eyebrow-dark">{eyebrow}</span>
          <h2 className="mt-4 text-[2.5rem] font-bold leading-[1.05] tracking-[-0.04em] xl:text-[2.875rem]">
            {title} <span className="text-primary">{highlight}</span>
          </h2>
          <ul className="mt-8 space-y-3">
            {points.map((p, i) => (
              <li key={p.title} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both" style={{ animationDelay: `${200 + i * 90}ms` }}>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">{p.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{p.title}</span>
                  <span className="block text-[13px] text-white/55">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
          {footnote && <p className="mt-8 text-xs text-white/40">{footnote}</p>}
        </div>
      </aside>

      <div className="relative z-10 -mt-10 flex min-h-[calc(100svh-12.5rem)] flex-col rounded-t-3xl bg-white lg:mt-0 lg:min-h-svh lg:rounded-none">
        <div className="hidden items-center justify-end px-10 pt-8 lg:flex">
          <Link href={backHref} className="inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground">
            <ArrowLeftIcon className="size-4" /> {backLabel}
          </Link>
        </div>
        <main className="flex flex-1 items-start justify-center px-5 pb-12 pt-8 sm:px-10 lg:items-center lg:pt-0">
          <div className="w-full max-w-[420px] animate-lift">{children}</div>
        </main>
      </div>
    </div>
  );
}
