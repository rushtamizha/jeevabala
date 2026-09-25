import { cn } from "cn";

/** Stylised side-view sedan in brand red (original artwork). */
export function CarIllustration({ className, tone = "red" }: { className?: string; tone?: "red" | "ink" }) {
  const body = tone === "red" ? "url(#car-red)" : "url(#car-ink)";
  return (
    <svg viewBox="0 0 480 170" className={cn("h-auto w-full", className)} aria-hidden>
      <defs>
        <linearGradient id="car-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(0.66 0.22 28)" />
          <stop offset="0.55" stopColor="oklch(0.55 0.22 26)" />
          <stop offset="1" stopColor="oklch(0.4 0.17 24)" />
        </linearGradient>
        <linearGradient id="car-ink" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(0.38 0.02 265)" />
          <stop offset="1" stopColor="oklch(0.18 0.012 265)" />
        </linearGradient>
        <linearGradient id="car-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.85 0.03 240)" stopOpacity="0.95" />
          <stop offset="1" stopColor="oklch(0.45 0.04 250)" stopOpacity="0.95" />
        </linearGradient>
        <radialGradient id="car-shadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="black" stopOpacity="0.35" />
          <stop offset="1" stopColor="black" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="240" cy="152" rx="210" ry="12" fill="url(#car-shadow)" />
      <path
        d="M34 118c-6-2-9-8-8-15l3-14c2-9 9-15 18-17l58-10 42-30c9-6 19-9 30-9h108c12 0 23 4 32 12l38 33 52 8c14 2 25 12 28 26l3 13c1 7-4 13-11 14l-26 3H62l-28-14Z"
        fill={body}
      />
      <path d="M152 58l30-22c7-5 15-7 23-7h42l6 38H146l6-9Z" fill="url(#car-glass)" />
      <path d="M262 29h36c9 0 17 3 24 9l30 27-84 2-6-38Z" fill="url(#car-glass)" />
      <path d="M40 104h410" stroke="white" strokeOpacity="0.18" strokeWidth="2" />
      <rect x="198" y="80" width="26" height="5" rx="2.5" fill="white" fillOpacity="0.55" />
      <rect x="296" y="80" width="26" height="5" rx="2.5" fill="white" fillOpacity="0.55" />
      <path d="M438 96h14c4 0 7 3 7 7v3h-21Z" fill="oklch(0.92 0.08 90)" />
      <path d="M30 98h14v10H28Z" fill="oklch(0.62 0.24 28)" opacity="0.9" />
      {[118, 360].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="128" r="30" fill="oklch(0.16 0.01 265)" />
          <circle cx={cx} cy="128" r="18" fill="oklch(0.55 0.01 265)" />
          <circle cx={cx} cy="128" r="7" fill="oklch(0.3 0.01 265)" />
        </g>
      ))}
    </svg>
  );
}
