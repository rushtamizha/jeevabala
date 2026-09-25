import { cn } from "cn";
import { PAYMENT_STATUS_LABEL, STATUS_LABEL, type BookingStatus, type PaymentStatus } from "@/lib/types";

/** Kit status pills: outlined orange (upcoming), green (completed), red (cancelled); filled orange while live. */
const TONE = {
  neutral: "border-[#bdbdbd] bg-card text-muted-foreground",
  primary: "border-primary bg-accent text-primary",
  live: "border-primary bg-primary text-primary-foreground",
  success: "border-success bg-success/8 text-success",
  danger: "border-destructive bg-destructive/6 text-destructive",
} as const;

const STATUS_TONE: Record<BookingStatus, keyof typeof TONE> = {
  PENDING: "neutral",
  CONFIRMED: "primary",
  EN_ROUTE: "live",
  ARRIVED: "live",
  IN_PROGRESS: "live",
  COMPLETED: "success",
  CANCELLED: "danger",
  REJECTED: "danger",
};

const PAY_TONE: Record<PaymentStatus, keyof typeof TONE> = {
  UNPAID: "danger",
  CLAIMED: "primary",
  PAID: "success",
  WAIVED: "neutral",
};

const LIVE = new Set<BookingStatus>(["PENDING", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"]);
const PILL = "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium whitespace-nowrap";

export function StatusBadge({ status, short, className }: { status: BookingStatus; short?: boolean; className?: string }) {
  const label = short ? { ...STATUS_LABEL, PENDING: "Pending", EN_ROUTE: "On the way", IN_PROGRESS: "On trip" }[status] : STATUS_LABEL[status];
  return (
    <span className={cn(PILL, TONE[STATUS_TONE[status]], className)}>
      {LIVE.has(status) && (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full rounded-full bg-current opacity-60 animate-ping-slow" />
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      )}
      {label}
    </span>
  );
}

export function PaymentBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  return <span className={cn(PILL, TONE[PAY_TONE[status]], className)}>{PAYMENT_STATUS_LABEL[status]}</span>;
}
