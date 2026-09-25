"use client";

import { useEffect, useRef, useState } from "react";

/**
 * React Bits "CountUp" without an animation library: a requestAnimationFrame
 * tween (ease-out-expo) that starts when the number scrolls into view.
 * Renders the final value when motion is reduced.
 */
export function CountUp({
  to,
  from = 0,
  duration = 1.6,
  format,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: {
  to: number;
  from?: number;
  duration?: number;
  /** Client-only custom formatter; from Server Components use decimals/prefix/suffix. */
  format?: (n: number) => string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const fmt =
    format ??
    ((n: number) => `${prefix}${n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`);
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(from);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      raf = requestAnimationFrame(() => setValue(to));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / (duration * 1000));
          const eased = t === 1 ? 1 : 1 - 2 ** (-10 * t);
          setValue(from + (to - from) * eased);
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [from, to, duration]);

  return (
    <span ref={ref} className={className}>
      {fmt(value)}
    </span>
  );
}
