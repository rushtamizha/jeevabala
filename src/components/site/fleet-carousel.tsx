"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Children, useRef, useState } from "react";
import type { Swiper as SwiperType } from "swiper";
import { A11y, Keyboard } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";

/**
 * Fleet carousel (Swiper). Cards are Server Components passed in as children;
 * the controls show a counter and a progress bar instead of dots.
 */
export function FleetRail({ children, label = "Vehicles" }: { children: React.ReactNode; label?: string }) {
  const slides = Children.toArray(children);
  const ref = useRef<SwiperType | null>(null);
  const [state, setState] = useState({ index: 0, start: true, end: slides.length <= 1, progress: 0 });
  const sync = (s: SwiperType) => setState({ index: s.activeIndex, start: s.isBeginning, end: s.isEnd, progress: s.progress });

  return (
    <div aria-label={label} role="region">
      <Swiper
        modules={[A11y, Keyboard]}
        slidesPerView={1.12}
        spaceBetween={12}
        breakpoints={{ 640: { slidesPerView: 2.1, spaceBetween: 16 }, 1024: { slidesPerView: 3, spaceBetween: 20 } }}
        keyboard={{ enabled: true, onlyInViewport: true }}
        grabCursor
        onSwiper={(s) => {
          ref.current = s;
          sync(s);
        }}
        onSlideChange={sync}
        onResize={sync}
        className="!-mx-4 !px-4 !pb-1 !pt-1 sm:!-mx-6 sm:!px-6 lg:!mx-0 lg:!px-0"
      >
        {slides.map((slide, i) => (
          <SwiperSlide key={i} className="!h-auto">
            {slide}
          </SwiperSlide>
        ))}
      </Swiper>

      <div className="mt-5 flex items-center gap-4">
        <span className="text-sm font-semibold tabular">
          {String(state.index + 1).padStart(2, "0")}
          <span className="text-muted-foreground"> / {String(slides.length).padStart(2, "0")}</span>
        </span>
        <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-border">
          <span className="block h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ transform: `scaleX(${Math.max(0.08, state.end ? 1 : state.progress)})` }} />
        </span>
        <div className="flex gap-2">
          <button type="button" aria-label="Previous vehicle" disabled={state.start} onClick={() => ref.current?.slidePrev()} className="grid size-11 place-items-center rounded-full border bg-card transition-colors hover:border-primary hover:text-primary disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground">
            <ArrowLeftIcon className="size-[18px]" />
          </button>
          <button type="button" aria-label="Next vehicle" disabled={state.end} onClick={() => ref.current?.slideNext()} className="grid size-11 place-items-center rounded-full bg-foreground text-white transition-colors hover:bg-primary disabled:opacity-40 disabled:hover:bg-foreground">
            <ArrowRightIcon className="size-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
