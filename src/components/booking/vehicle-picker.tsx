"use client";

import { cn } from "cn";
import { ChevronLeftIcon, ChevronRightIcon, UsersIcon } from "lucide-react";
import { useRef, useState } from "react";
import type { Swiper as SwiperType } from "swiper";
import { A11y, FreeMode, Mousewheel } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import { VehicleArt } from "@/components/site/vehicle-art";
import { formatINR, formatRate } from "@/lib/format";
import type { TripType } from "@/lib/types";
import type { BookingVehicle } from "./types";

const UNIT_LABEL: Record<TripType, string> = { ONE_WAY: "one way", ROUND_TRIP: "round trip", AIRPORT: "airport base", LOCAL: "package" };

/** The headline fare for a vehicle under the selected trip type and AC choice. */
export function vehicleFare(v: BookingVehicle, trip: TripType, isAc: boolean, pkgId?: string): { value: string; unit: string } {
  const pick = (r: { ac: number; nonAc: number }) => (isAc || !r.nonAc ? r.ac : r.nonAc);
  switch (trip) {
    case "ONE_WAY":
      return { value: formatRate(pick(v.rates.oneWay)), unit: "/km" };
    case "ROUND_TRIP":
      return { value: formatRate(pick(v.rates.roundTrip)), unit: "/km" };
    case "AIRPORT":
      return { value: formatINR(pick(v.rates.airport)), unit: "" };
    case "LOCAL": {
      const l = v.rates.local.find((x) => x.id === pkgId) ?? v.rates.local[0];
      return l ? { value: formatINR(pick(l)), unit: "" } : { value: formatRate(v.fromPerKm), unit: "/km" };
    }
  }
}

/** Swipeable vehicle chooser (Swiper free-mode) whose prices follow the trip type. */
export function VehiclePicker({
  vehicles,
  value,
  onChange,
  tripType,
  isAc,
  pkgId,
}: {
  vehicles: BookingVehicle[];
  value: string | undefined;
  onChange: (id: string) => void;
  tripType: TripType;
  isAc: boolean;
  pkgId?: string;
}) {
  const ref = useRef<SwiperType | null>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const selected = Math.max(0, vehicles.findIndex((v) => v.id === value));
  const sync = (s: SwiperType) => setEdge((p) => (p.start === s.isBeginning && p.end === s.isEnd ? p : { start: s.isBeginning, end: s.isEnd }));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[13px] font-medium">
          Vehicle <span className="text-muted-foreground">· fares shown for {UNIT_LABEL[tripType]}</span>
        </p>
        <div className="flex gap-1">
          <button type="button" aria-label="Previous vehicles" disabled={edge.start} onClick={() => ref.current?.slidePrev()} className="grid size-7 place-items-center rounded-full bg-secondary text-foreground transition-colors hover:bg-accent hover:text-primary disabled:opacity-35">
            <ChevronLeftIcon className="size-4" />
          </button>
          <button type="button" aria-label="More vehicles" disabled={edge.end} onClick={() => ref.current?.slideNext()} className="grid size-7 place-items-center rounded-full bg-secondary text-foreground transition-colors hover:bg-accent hover:text-primary disabled:opacity-35">
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
      </div>
      <div role="radiogroup" aria-label="Vehicle" className="-mx-1">
        <Swiper
          modules={[A11y, FreeMode, Mousewheel]}
          slidesPerView="auto"
          spaceBetween={8}
          freeMode={{ enabled: true, momentumRatio: 0.5, sticky: false }}
          mousewheel={{ forceToAxis: true }}
          initialSlide={selected}
          onSwiper={(s) => {
            ref.current = s;
            sync(s);
          }}
          onSlideChange={sync}
          onReachBeginning={sync}
          onReachEnd={sync}
          onProgress={sync}
          className="!px-1 !py-1"
        >
          {vehicles.map((v, i) => {
            const active = v.id === value;
            const fare = vehicleFare(v, tripType, isAc, pkgId);
            return (
              <SwiperSlide key={v.id} className="!w-[8.5rem]">
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${v.name}, ${v.seats} seats, ${fare.value}${fare.unit}`}
                  onClick={() => {
                    onChange(v.id);
                    ref.current?.slideTo(Math.max(0, i - 1));
                  }}
                  className={cn(
                    "relative flex w-full flex-col rounded-xl border p-2.5 text-left transition-[border-color,background-color,box-shadow]",
                    active ? "border-primary bg-card shadow-[0_0_0_3px_rgb(251_91_33/0.12)]" : "border-transparent bg-secondary hover:border-border",
                  )}
                >
                  <span aria-hidden className={cn("absolute right-2 top-2 grid size-4 place-items-center rounded-full border-[1.5px] bg-card", active ? "border-primary" : "border-[#c9c9c9]")}>
                    {active && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                  <span className="mx-auto block h-9 w-full">
                    <VehicleArt category={v.category} tone="ink" className="h-9" />
                  </span>
                  <span className="mt-1.5 block truncate text-[13px] font-semibold">{v.name}</span>
                  <span className="mt-0.5 flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-0.5">
                      <UsersIcon className="size-3" /> {v.seats}
                    </span>
                    <span key={`${tripType}-${isAc}-${pkgId}`} className="truncate font-bold text-foreground tabular animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
                      {fare.value}
                      <span className="font-medium text-muted-foreground">{fare.unit}</span>
                    </span>
                  </span>
                </button>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>
    </div>
  );
}
