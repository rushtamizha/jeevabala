import { cn } from "cn";

/** React Bits "CircularText": a slowly spinning ring of text around a centre mark (SVG + CSS only). */
export function CircularText({ text, className, children }: { text: string; className?: string; children?: React.ReactNode }) {
  const id = `ct-${text.length}-${text.charCodeAt(0)}`;
  return (
    <span className={cn("relative inline-grid size-36 place-items-center", className)}>
      <svg viewBox="0 0 200 200" aria-hidden className="absolute inset-0 size-full animate-spin-slow">
        <defs>
          <path id={id} d="M100 100 m-78 0 a78 78 0 1 1 156 0 a78 78 0 1 1 -156 0" />
        </defs>
        {/* textLength stretches the letter-spacing so any phrase closes the ring exactly (2πr ≈ 490). */}
        <text className="fill-current text-[15px] font-semibold uppercase">
          <textPath href={`#${id}`} textLength={488} lengthAdjust="spacing">
            {text}
          </textPath>
        </text>
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}
