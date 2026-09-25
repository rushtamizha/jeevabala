"use client";

import { cn } from "cn";
import { CalendarDaysIcon, ChevronDownIcon, ClockIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { zonedParts } from "@/lib/time";

export type WallValue = { date: string; time: string } | null;

// The calendar (react-day-picker + date-fns) is only needed once the picker opens — keep it off the first load.
const loadCalendar = () => import("@/components/ui/calendar").then((m) => m.Calendar);
const Calendar = dynamic(loadCalendar, { ssr: false, loading: () => <div className="h-[19rem] w-[17.5rem] animate-pulse rounded-xl bg-secondary/60" /> });

const pad = (n: number) => String(n).padStart(2, "0");
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromDateStr = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function formatLabel(v: WallValue) {
  if (!v) return null;
  const d = fromDateStr(v.date);
  const day = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  if (!v.time) return { day, time: "pick a time" };
  const [h, m] = v.time.split(":").map(Number);
  const hr = h % 12 === 0 ? 12 : h % 12;
  return { day, time: `${hr}:${pad(m)} ${h >= 12 ? "PM" : "AM"}` };
}

/** Earliest bookable wall-clock time in the business timezone. */
export function earliestSlot(tz: string, leadMinutes: number) {
  const now = zonedParts(new Date(Date.now() + leadMinutes * 60_000), tz);
  let minutes = now.hour * 60 + now.minute;
  minutes = Math.ceil(minutes / 15) * 15;
  const base = new Date(now.year, now.month - 1, now.day);
  if (minutes >= 24 * 60) {
    base.setDate(base.getDate() + 1);
    minutes = 0;
  }
  return { date: toDateStr(base), minutes };
}

export function DateTimeField({
  label,
  value,
  onChange,
  timezone,
  leadMinutes,
  maxAdvanceDays,
  minValue,
  invalid,
}: {
  label: string;
  value: WallValue;
  onChange: (v: WallValue) => void;
  timezone: string;
  leadMinutes: number;
  maxAdvanceDays: number;
  /** Optional lower bound (e.g. return must be after pickup). */
  minValue?: WallValue;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const earliest = useMemo(() => earliestSlot(timezone, leadMinutes), [timezone, leadMinutes, open]); // eslint-disable-line react-hooks/exhaustive-deps
  const minDate = minValue && minValue.date > earliest.date ? minValue.date : earliest.date;
  const maxDate = useMemo(() => {
    const d = fromDateStr(earliest.date);
    d.setDate(d.getDate() + maxAdvanceDays);
    return toDateStr(d);
  }, [earliest.date, maxAdvanceDays]);

  const selectedDate = value?.date ?? minDate;
  const slots = useMemo(() => {
    const out: string[] = [];
    let start = 0;
    if (selectedDate === earliest.date) start = earliest.minutes;
    if (minValue && selectedDate === minValue.date) {
      const [h, m] = minValue.time.split(":").map(Number);
      start = Math.max(start, h * 60 + m + 60);
    }
    for (let t = Math.ceil(start / 15) * 15; t < 24 * 60; t += 15) out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
    return out;
  }, [selectedDate, earliest, minValue]);

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>("[data-selected=true]") ?? listRef.current?.querySelector<HTMLElement>("[data-slot]");
    el?.scrollIntoView({ block: "center" });
  }, [open, selectedDate]);

  const shown = formatLabel(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerEnter={() => void loadCalendar()}
          onFocus={() => void loadCalendar()}
          data-invalid={invalid || undefined}
          className={cn(
            "group flex h-14 w-full items-center gap-3 rounded-xl border border-transparent bg-secondary pl-3 pr-3.5 text-left transition-[background-color,border-color,box-shadow] hover:bg-[#f0f0f0] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 data-[state=open]:border-primary data-[state=open]:bg-card data-[state=open]:ring-4 data-[state=open]:ring-primary/10 dark:bg-white/[0.05]",
            invalid && "border-destructive/60 ring-4 ring-destructive/10",
          )}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-primary">
            <CalendarDaysIcon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs leading-none text-muted-foreground">{label}</span>
            {shown ? (
              <span className="mt-1 block truncate text-[15px] font-medium leading-tight">
                {shown.day} <span className="text-muted-foreground">·</span> {shown.time}
              </span>
            ) : (
              <span className="mt-1 block truncate text-[15px] leading-tight text-muted-foreground">Select date & time</span>
            )}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl p-0 shadow-float" sideOffset={8}>
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="single"
            className="[--cell-size:--spacing(9)] p-3"
            selected={fromDateStr(selectedDate)}
            defaultMonth={fromDateStr(selectedDate)}
            startMonth={fromDateStr(minDate)}
            endMonth={fromDateStr(maxDate)}
            disabled={[{ before: fromDateStr(minDate) }, { after: fromDateStr(maxDate) }]}
            onSelect={(d) => {
              if (!d) return;
              const date = toDateStr(d);
              const keepTime = value?.time;
              onChange({ date, time: keepTime ?? "" });
            }}
          />
          <div className="border-t sm:w-40 sm:border-l sm:border-t-0">
            <div className="flex items-center gap-1.5 px-3 pt-3 text-xs font-medium text-muted-foreground">
              <ClockIcon className="size-3.5" /> Pickup time
            </div>
            <div ref={listRef} className="grid max-h-44 grid-cols-3 gap-1 overflow-y-auto p-2 sm:max-h-[292px] sm:grid-cols-1">
              {slots.length === 0 && <p className="col-span-3 p-2 text-xs text-muted-foreground">No slots left today — pick another date.</p>}
              {slots.map((t) => {
                const [h, m] = t.split(":").map(Number);
                const selected = value?.date === selectedDate && value?.time === t;
                return (
                  <button
                    key={t}
                    type="button"
                    data-slot
                    data-selected={selected}
                    onClick={() => {
                      onChange({ date: selectedDate, time: t });
                      setOpen(false);
                    }}
                    className={cn(
                      "rounded-full px-2 py-1.5 text-sm tabular transition-colors",
                      selected ? "bg-primary font-semibold text-primary-foreground" : "bg-secondary hover:bg-[#ededed]",
                    )}
                  >
                    {h % 12 === 0 ? 12 : h % 12}:{pad(m)} {h >= 12 ? "PM" : "AM"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
