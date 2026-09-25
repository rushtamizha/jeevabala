"use client";

import { cn } from "cn";
import { motion } from "framer-motion";
import { CarFrontIcon, CheckIcon, ClipboardCheckIcon, FlagIcon, MapPinCheckIcon, NavigationIcon, ThumbsUpIcon, WalletIcon } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { BookingStatus, PaymentStatus } from "@/lib/types";

type Ev = { type: string; toStatus: BookingStatus | null; message: string | null; createdAt: string };

const STEPS = [
  { key: "PENDING", label: "Ride requested", icon: ClipboardCheckIcon },
  { key: "CONFIRMED", label: "Confirmed by driver", icon: ThumbsUpIcon },
  { key: "EN_ROUTE", label: "Driver on the way", icon: NavigationIcon },
  { key: "ARRIVED", label: "Driver arrived", icon: MapPinCheckIcon },
  { key: "IN_PROGRESS", label: "Trip started", icon: CarFrontIcon },
  { key: "COMPLETED", label: "Trip completed", icon: FlagIcon },
  { key: "PAID", label: "Payment received", icon: WalletIcon },
] as const;

const ORDER: Record<string, number> = { PENDING: 0, CONFIRMED: 1, EN_ROUTE: 2, ARRIVED: 3, IN_PROGRESS: 4, COMPLETED: 6 };

/** Vertical ride status timeline with timestamps (reference "Order Status" style). */
export function StatusStepper({ status, paymentStatus, events, tz }: { status: BookingStatus; paymentStatus: PaymentStatus; events: Ev[]; tz: string }) {
  if (status === "CANCELLED" || status === "REJECTED") return null;
  let current = ORDER[status] ?? 0;
  const paid = paymentStatus === "PAID" || paymentStatus === "WAIVED";
  if (status === "COMPLETED" && paid) current = 7;
  const times: Record<string, string | undefined> = {};
  for (const e of events) {
    if (e.type === "CREATED") times.PENDING ??= e.createdAt;
    if (e.toStatus && e.type === "STATUS") times[e.toStatus] = e.createdAt;
    if (e.type === "PAYMENT" && /received|waived/i.test(e.message ?? "")) times.PAID = e.createdAt;
  }
  return (
    <ol className="relative" aria-label="Ride progress">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const last = i === STEPS.length - 1;
        return (
          <motion.li
            key={s.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className="relative flex gap-4 pb-6 last:pb-0"
            aria-current={active ? "step" : undefined}
          >
            {!last && (
              <span className="absolute left-[13px] top-7 h-[calc(100%-1.5rem)] w-[3px] rounded-full bg-border">
                <motion.span
                  className="absolute inset-x-0 top-0 rounded-full bg-primary"
                  initial={{ height: 0 }}
                  animate={{ height: done ? "100%" : active ? "35%" : 0 }}
                  transition={{ duration: 0.6, delay: 0.15 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
            )}
            <span
              className={cn(
                "relative z-10 grid size-[29px] shrink-0 place-items-center rounded-full border-2 transition-colors",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary bg-card text-primary",
                !done && !active && "border-border bg-card text-transparent",
              )}
            >
              {active && <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping-slow" />}
              {done ? <CheckIcon className="size-4" strokeWidth={3} /> : active ? <span className="size-2.5 rounded-full bg-primary" /> : null}
            </span>
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3">
              <div className="min-w-0">
                <p className={cn("text-sm font-semibold", !done && !active && "text-muted-foreground")}>{s.label}</p>
                <p className="text-xs text-muted-foreground">{times[s.key] ? formatDateTime(times[s.key]!, tz, "short") : active ? "In progress" : "—"}</p>
              </div>
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", done || active ? "bg-accent text-primary" : "bg-secondary text-muted-foreground")}>
                <s.icon className="size-4" />
              </span>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
