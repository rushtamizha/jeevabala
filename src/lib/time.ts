/**
 * Timezone helpers built on Intl (no dependencies). All booking times are
 * "wall-clock" times in the business timezone (the ride happens there), even if
 * the customer's device is elsewhere.
 */

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string) {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatterCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function zonedParts(date: Date, tz: string): Parts {
  const out: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(date)) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: WEEKDAYS.indexOf(out.weekday),
  };
}

/** Offset of `tz` from UTC at the given instant, in minutes (IST = +330). */
export function tzOffsetMinutes(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

export const WALL_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Convert a wall-clock time ("YYYY-MM-DDTHH:mm") in `tz` to a UTC Date. */
export function wallTimeToUtc(wall: string, tz: string): Date {
  const m = WALL_TIME_RE.exec(wall);
  if (!m) throw new Error("Invalid date/time");
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) throw new Error("Invalid date/time");
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let result = guess - tzOffsetMinutes(new Date(guess), tz) * 60000;
  // Re-check around DST transitions.
  const second = guess - tzOffsetMinutes(new Date(result), tz) * 60000;
  if (second !== result) result = second;
  const check = zonedParts(new Date(result), tz);
  if (check.day !== d || check.month !== mo) throw new Error("Invalid date/time");
  return new Date(result);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function utcToWallTime(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function wallDate(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Number of calendar days (in `tz`) touched by [start, end], inclusive. */
export function calendarDaysSpanned(start: Date, end: Date, tz: string): number {
  const a = zonedParts(start, tz);
  const b = zonedParts(end, tz);
  const da = Date.UTC(a.year, a.month - 1, a.day);
  const db = Date.UTC(b.year, b.month - 1, b.day);
  return Math.max(1, Math.round((db - da) / 86_400_000) + 1);
}

export function isNightHour(hour: number, startHour: number, endHour: number): boolean {
  if (startHour === endHour) return false;
  return startHour > endHour ? hour >= startHour || hour < endHour : hour >= startHour && hour < endHour;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
