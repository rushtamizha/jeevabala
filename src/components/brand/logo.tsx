import { cn } from "cn";

/** Brand mark in the kit's splash style: a white location pin on a solid orange tile, with a steering wheel inside. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary text-white", className)}>
      <svg viewBox="0 0 24 24" className="size-[70%]" aria-hidden>
        <path d="M12 2.2c-4.1 0-7.4 3.2-7.4 7.3 0 5.2 6.1 11.4 6.8 12.1.3.3.9.3 1.2 0 .7-.7 6.8-6.9 6.8-12.1 0-4.1-3.3-7.3-7.4-7.3Z" fill="currentColor" />
        <g fill="none" stroke="var(--primary)" strokeWidth="1.7" strokeLinecap="round">
          <circle cx="12" cy="9.6" r="4.1" />
          <path d="M8.1 8.7c1.2-.4 2.5-.6 3.9-.6s2.7.2 3.9.6M12 10.8v2.8" />
        </g>
        <circle cx="12" cy="9.9" r="1.1" fill="var(--primary)" />
      </svg>
    </span>
  );
}

/** Wordmark: "Name." — the kit's splash wordmark ends with a full stop. */
export function Logo({ name, className, compact, tone = "default" }: { name: string; className?: string; compact?: boolean; tone?: "default" | "inverse" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={tone === "inverse" ? "bg-white text-primary [&_g]:stroke-white [&_circle[fill]]:fill-white" : undefined} />
      {!compact && (
        <span className={cn("text-[19px] font-bold leading-none tracking-[-0.03em]", tone === "inverse" ? "text-white" : "text-foreground")}>
          {name}
          <span className={tone === "inverse" ? "text-white" : "text-primary"}>.</span>
        </span>
      )}
    </span>
  );
}
