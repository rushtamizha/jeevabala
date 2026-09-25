import { cn } from "cn";

/** Original side-view silhouettes per vehicle class (used when no photo is uploaded). */
const BODIES: Record<string, { body: string; windows: string[]; wheels: [number, number]; view: string }> = {
  HATCHBACK: {
    view: "0 0 420 170",
    body: "M40 118c-6-2-9-8-8-15l4-16c2-9 9-15 18-17l50-9 40-34c8-6 17-9 27-9h92c12 0 23 5 31 13l32 36 34 6c13 2 22 12 25 25l2 12c1 7-4 13-11 14l-22 3H64Z",
    windows: ["M150 58l28-24c6-5 13-7 21-7h38l5 39H142Z", "M253 27h26c9 0 17 4 23 10l26 29-70 1Z"],
    wheels: [110, 318],
  },
  SEDAN: {
    view: "0 0 480 170",
    body: "M34 118c-6-2-9-8-8-15l3-14c2-9 9-15 18-17l58-10 42-30c9-6 19-9 30-9h108c12 0 23 4 32 12l38 33 52 8c14 2 25 12 28 26l3 13c1 7-4 13-11 14l-26 3H62Z",
    windows: ["M152 58l30-22c7-5 15-7 23-7h42l6 38H146Z", "M262 29h36c9 0 17 3 24 9l30 27-84 2Z"],
    wheels: [118, 360],
  },
  SUV: {
    view: "0 0 480 180",
    body: "M30 128c-6-2-10-8-9-15l3-24c2-10 10-17 20-18l56-7 34-36c8-8 18-12 29-12h150c12 0 22 5 29 14l30 38 58 8c14 2 24 13 26 27l2 13c1 7-4 13-11 14l-26 3H58Z",
    windows: ["M146 62l26-28c6-6 13-9 21-9h46v43H140Z", "M252 25h58c8 0 15 4 20 10l25 32-103 1Z"],
    wheels: [116, 362],
  },
  MUV: {
    view: "0 0 480 180",
    body: "M28 128c-6-2-10-8-9-15l3-24c2-10 10-17 20-18l62-8 32-34c8-9 19-13 31-13h160c12 0 23 6 29 16l26 36 54 8c14 2 24 13 26 27l2 13c1 7-4 13-11 14l-26 3H56Z",
    windows: ["M148 64l24-27c6-6 14-9 22-9h40v42H142Z", "M246 28h52v41h-52Z", "M310 28h18c9 0 16 5 20 13l14 28h-52Z"],
    wheels: [116, 366],
  },
  LUXURY: {
    view: "0 0 480 180",
    body: "M28 128c-6-2-10-8-9-15l3-24c2-10 10-17 20-18l62-8 32-34c8-9 19-13 31-13h160c12 0 23 6 29 16l26 36 54 8c14 2 24 13 26 27l2 13c1 7-4 13-11 14l-26 3H56Z",
    windows: ["M148 64l24-27c6-6 14-9 22-9h40v42H142Z", "M246 28h52v41h-52Z", "M310 28h18c9 0 16 5 20 13l14 28h-52Z"],
    wheels: [116, 366],
  },
  TEMPO: {
    view: "0 0 520 190",
    body: "M24 138c-6-2-10-8-10-15V52c0-14 11-25 25-25h330c10 0 19 5 25 13l40 52 52 10c14 3 24 15 24 29v10c0 7-5 12-12 13l-26 2H52Z",
    windows: ["M44 44h66v44H44Z", "M122 44h66v44h-66Z", "M200 44h66v44h-66Z", "M278 44h66v44h-66Z", "M356 44h14c7 0 13 3 17 9l26 35h-57Z"],
    wheels: [112, 412],
  },
  BUS: {
    view: "0 0 520 190",
    body: "M24 138c-6-2-10-8-10-15V52c0-14 11-25 25-25h330c10 0 19 5 25 13l40 52 52 10c14 3 24 15 24 29v10c0 7-5 12-12 13l-26 2H52Z",
    windows: ["M44 44h66v44H44Z", "M122 44h66v44h-66Z", "M200 44h66v44h-66Z", "M278 44h66v44h-66Z", "M356 44h14c7 0 13 3 17 9l26 35h-57Z"],
    wheels: [112, 412],
  },
};

export function VehicleArt({ category, className, tone = "brand" }: { category: string; className?: string; tone?: "brand" | "ink" | "white" }) {
  const b = BODIES[category] ?? BODIES.SEDAN;
  const [, , w, h] = b.view.split(" ").map(Number);
  const id = `va-${category}-${tone}`;
  const fill = tone === "white" ? "#ffffff" : `url(#${id})`;
  return (
    <svg viewBox={b.view} className={cn("h-auto w-full", className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          {tone === "ink" ? (
            <>
              <stop offset="0" stopColor="oklch(0.4 0.02 265)" />
              <stop offset="1" stopColor="oklch(0.2 0.012 265)" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="oklch(0.7 0.19 38)" />
              <stop offset="0.55" stopColor="oklch(0.6 0.2 33)" />
              <stop offset="1" stopColor="oklch(0.45 0.17 28)" />
            </>
          )}
        </linearGradient>
        <radialGradient id={`${id}-sh`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="black" stopOpacity="0.3" />
          <stop offset="1" stopColor="black" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={w / 2} cy={h - 16} rx={w * 0.44} ry="11" fill={`url(#${id}-sh)`} />
      <path d={b.body} fill={fill} />
      {b.windows.map((d, i) => (
        <path key={i} d={d} fill={tone === "white" ? "oklch(0.85 0.03 250)" : "oklch(0.82 0.03 240)"} opacity="0.92" />
      ))}
      {b.wheels.map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={h - 42} r="29" fill="oklch(0.17 0.01 265)" />
          <circle cx={cx} cy={h - 42} r="17" fill="oklch(0.58 0.01 265)" />
          <circle cx={cx} cy={h - 42} r="6" fill="oklch(0.3 0.01 265)" />
        </g>
      ))}
    </svg>
  );
}
