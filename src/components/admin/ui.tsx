import { cn } from "cn";
import Link from "next/link";

/** Page title row for the console: title, one-line description, actions on the right. */
export function PageTitle({ title, description, actions }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** White panel with a hairline header — the one container every dashboard block uses. */
export function DashPanel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: React.ReactNode;
  description?: string;
  action?: { href: string; label: string } | React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const link = action && typeof action === "object" && "href" in (action as object) ? (action as { href: string; label: string }) : null;
  return (
    <section className={cn("flex flex-col overflow-hidden rounded-2xl border bg-card", className)}>
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {link ? (
          <Link href={link.href} className="shrink-0 text-[13px] font-semibold text-primary hover:underline">
            {link.label}
          </Link>
        ) : (
          (action as React.ReactNode)
        )}
      </div>
      <div className={cn("flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
