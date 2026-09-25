import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Centered icon-in-circle empty state (reference style). */
export function EmptyState({ icon: Icon, title, body, cta }: { icon: LucideIcon; title: string; body?: string; cta?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-20 place-items-center rounded-full bg-secondary">
        <Icon className="size-8 text-primary" />
      </span>
      <h3 className="mt-5 text-lg font-semibold">{title}</h3>
      {body && <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{body}</p>}
      {cta && (
        <Button asChild size="xl" className="mt-6 min-w-56">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      )}
    </div>
  );
}
