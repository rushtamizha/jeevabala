/** Client-safe formatting helpers. Money is always integer paise. */

const inr0 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const num = new Intl.NumberFormat("en-IN");

export function formatINR(paise: number, opts: { decimals?: boolean } = {}): string {
  const rupees = paise / 100;
  if (opts.decimals || (!Number.isInteger(rupees) && Math.abs(rupees) < 100)) return inr2.format(rupees);
  return inr0.format(Math.round(rupees));
}

/** "₹14/km" style compact rate label (keeps paise when non-integral). */
export function formatRate(paise: number): string {
  const rupees = paise / 100;
  return Number.isInteger(rupees) ? `₹${num.format(rupees)}` : `₹${rupees.toFixed(2)}`;
}

export const toPaise = (rupees: number) => Math.round(rupees * 100);
export const toRupees = (paise: number) => paise / 100;

export function formatNumber(n: number): string {
  return num.format(n);
}

export function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${num.format(Math.round(km))} km`;
}

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} hr${h > 1 ? "s" : ""}`;
  return `${h}h ${r}m`;
}

export function formatDateTime(
  date: Date | string | number,
  tz: string,
  style: "full" | "date" | "time" | "short" | "day" = "full",
): string {
  const d = new Date(date);
  const opts: Intl.DateTimeFormatOptions = { timeZone: tz };
  switch (style) {
    case "date":
      Object.assign(opts, { day: "numeric", month: "short", year: "numeric" });
      break;
    case "time":
      Object.assign(opts, { hour: "numeric", minute: "2-digit", hour12: true });
      break;
    case "short":
      Object.assign(opts, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
      break;
    case "day":
      Object.assign(opts, { weekday: "short", day: "numeric", month: "short" });
      break;
    default:
      Object.assign(opts, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
  }
  return new Intl.DateTimeFormat("en-IN", opts).format(d);
}

export function formatRelative(date: Date | string | number, now = Date.now()): string {
  const diff = new Date(date).getTime() - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  if (abs < MIN) return "just now";
  if (abs < HOUR) return rtf.format(Math.round(diff / MIN), "minute");
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), "hour");
  if (abs < 30 * DAY) return rtf.format(Math.round(diff / DAY), "day");
  return rtf.format(Math.round(diff / (30 * DAY)), "month");
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${"•".repeat(Math.max(2, Math.min(6, user.length - visible.length)))}@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "•••";
  const cc = digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : "";
  return `${cc}${digits.slice(-10, -8)}•••••${digits.slice(-3)}`;
}

/** Display an E.164 Indian number as "+91 98765 43210". */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  if (m) return `+91 ${m[1]} ${m[2]}`;
  return e164;
}

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Digits-only phone for tel:/wa.me links. */
export function phoneDigits(e164: string): string {
  return e164.replace(/\D/g, "");
}
