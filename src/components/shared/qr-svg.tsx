import { cn } from "cn";

/** Renders a pre-computed QR path (see lib/server/qr.ts) – no innerHTML, CSP friendly. */
export function QrSvg({ qr, className, label }: { qr: { size: number; path: string }; className?: string; label: string }) {
  const pad = 2;
  const dim = qr.size + pad * 2;
  return (
    <svg
      viewBox={`0 0 ${dim} ${dim}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={cn("h-auto w-full rounded-xl bg-white", className)}
    >
      <rect width={dim} height={dim} fill="#ffffff" />
      <path d={qr.path} transform={`translate(${pad} ${pad})`} fill="#0b0b0f" />
    </svg>
  );
}
