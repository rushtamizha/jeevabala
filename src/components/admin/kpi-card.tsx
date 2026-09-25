import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

/** Console KPI tile: label + icon tile, big tabular value, a quiet sub line. Staggers in with `index`. */
export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
  tone = "default",
  index = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
  tone?: "default" | "primary" | "warning" | "success";
  index?: number;
}) {
  const body = (
    <div
      className={cn(
        "group relative h-full overflow-hidden rounded-2xl border bg-card p-4 animate-rise-in transition-[border-color,box-shadow] sm:p-5",
        href && "hover:border-primary/30 hover:shadow-premium",
        tone === "primary" && "border-primary/35",
        tone === "warning" && "border-warning/50",
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {tone === "primary" && <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-primary" />}
      {tone === "warning" && <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-warning" />}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            "grid size-9 place-items-center rounded-xl transition-colors",
            tone === "primary" ? "bg-primary text-primary-foreground" : tone === "warning" ? "bg-warning/15 text-[#b45309]" : "bg-secondary text-foreground/70 group-hover:bg-accent group-hover:text-primary",
          )}
        >
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="mt-3 text-[1.625rem] font-bold leading-none tracking-tight tabular sm:text-[1.875rem]">{value}</p>
      {sub && <p className="mt-2 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl">
      {body}
    </Link>
  ) : (
    body
  );
}
