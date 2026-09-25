import { cn } from "cn";

function scallopPath(n = 12, r = 40, bump = 5.5, cx = 50, cy = 50) {
  const pt = (rad: number, a: number) => `${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
  let d = "";
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
    const a2 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) d += `M${pt(r, a0)}`;
    d += ` Q${pt(r + bump * 2, a1)} ${pt(r, a2)}`;
  }
  return `${d}Z`;
}

const PATH = scallopPath();

/** Scalloped check badge with a pop + draw animation (CSS only). */
export function SuccessBadge({ className, tone = "primary" }: { className?: string; tone?: "primary" | "success" }) {
  return (
    <span className={cn("relative inline-grid size-24 place-items-center", className)}>
      <svg viewBox="0 0 100 100" className="relative size-full animate-pop-in" aria-hidden>
        <path d={PATH} className={tone === "primary" ? "fill-primary" : "fill-success"} />
        <path
          d="M34 51.5 45 62l21-23"
          fill="none"
          stroke="white"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="60"
          strokeDashoffset="60"
          style={{ animation: "check-draw 0.45s 0.45s ease-out forwards" }}
        />
      </svg>
    </span>
  );
}
