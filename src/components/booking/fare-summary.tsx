"use client";

import { cn } from "cn";
import { ChevronDownIcon, ClockIcon, InfoIcon, RouteIcon, SparklesIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { CountUp } from "@/components/reactbits/count-up";
import { formatDuration, formatINR, formatKm } from "@/lib/format";
import type { FareBreakdown } from "@/lib/types";

export function FareLines({ fare, className }: { fare: FareBreakdown; className?: string }) {
  return (
    <dl className={cn("space-y-2.5 text-sm", className)}>
      {fare.lines.map((l) => (
        <div key={l.key + l.label} className="flex items-start justify-between gap-4">
          <dt className="min-w-0">
            <span className="text-foreground/90">{l.label}</span>
            {l.hint && <span className="block text-xs text-muted-foreground">{l.hint}</span>}
          </dt>
          <dd className={cn("shrink-0 tabular font-medium", l.amount < 0 && "text-success dark:text-success")}>
            {l.amount < 0 ? `− ${formatINR(-l.amount)}` : formatINR(l.amount)}
          </dd>
        </div>
      ))}
      {fare.discounts.map((d) => (
        <div key={d.key} className="flex items-start justify-between gap-4 text-success dark:text-success">
          <dt className="inline-flex items-center gap-1.5">
            <SparklesIcon className="size-3.5" /> {d.label}
          </dt>
          <dd className="shrink-0 tabular font-medium">− {formatINR(d.amount)}</dd>
        </div>
      ))}
      {fare.tax > 0 && (
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">GST ({fare.taxPercent}%)</dt>
          <dd className="tabular font-medium">{formatINR(fare.tax)}</dd>
        </div>
      )}
      {fare.roundOff !== 0 && (
        <div className="flex justify-between gap-4 text-muted-foreground">
          <dt>Round off</dt>
          <dd className="tabular">{fare.roundOff > 0 ? "+" : "−"} {formatINR(Math.abs(fare.roundOff), { decimals: true })}</dd>
        </div>
      )}
    </dl>
  );
}

export function FareSummary({
  fare,
  distanceKm,
  durationMin,
  availability,
  approximate,
}: {
  fare: FareBreakdown;
  distanceKm: number | null;
  durationMin: number | null;
  availability: { ok: true } | { ok: false; reason: string };
  approximate?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const saved = fare.discountTotal;
  return (
    <div className="overflow-hidden rounded-2xl border bg-gradient-to-b from-primary/[0.07] to-transparent">
      <div className="flex items-end justify-between gap-4 p-4 sm:p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Estimated fare</p>
          <p className="mt-1 text-4xl font-bold tracking-tight tabular">
            <CountUp to={fare.total / 100} duration={0.9} format={(n) => formatINR(Math.round(n) * 100)} />
          </p>
          {saved > 0 && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success dark:text-success">
              <SparklesIcon className="size-3" /> You save {formatINR(saved)}
            </p>
          )}
        </div>
        <div className="space-y-1 text-right text-sm">
          {distanceKm !== null && (
            <p className="inline-flex items-center gap-1.5 text-muted-foreground">
              <RouteIcon className="size-3.5" /> {formatKm(distanceKm)}
            </p>
          )}
          {durationMin !== null && durationMin > 0 && (
            <p className="flex items-center justify-end gap-1.5 text-muted-foreground">
              <ClockIcon className="size-3.5" /> ~{formatDuration(durationMin)}
            </p>
          )}
        </div>
      </div>

      {!availability.ok && (
        <div className="mx-4 mb-4 flex gap-2.5 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-primary dark:text-primary sm:mx-5">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <p>{availability.reason}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between border-t px-4 py-3 text-sm font-medium hover:bg-muted/40 sm:px-5"
      >
        Fare breakdown
        <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="overflow-hidden" inert={!open}>
            <div className="space-y-4 px-4 pb-4 sm:px-5">
              <FareLines fare={fare} />
              <div className="flex justify-between border-t pt-3 text-base font-semibold">
                <span>Total</span>
                <span className="tabular">{formatINR(fare.total)}</span>
              </div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {fare.notes.map((n) => (
                  <li key={n} className="flex gap-1.5">
                    <InfoIcon className="mt-0.5 size-3 shrink-0" /> {n}
                  </li>
                ))}
                {approximate && (
                  <li className="flex gap-1.5">
                    <InfoIcon className="mt-0.5 size-3 shrink-0" /> Distance is approximate; the driver confirms the final fare.
                  </li>
                )}
              </ul>
            </div>
          </div>
      </div>
    </div>
  );
}
