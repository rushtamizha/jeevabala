"use client";

import { useRef } from "react";

/**
 * React Bits "SpotlightCard", delegated: one pointer listener on the group
 * moves the light on whichever `.spotlight` card is under the cursor, so the
 * cards themselves stay Server Components with zero hydration cost.
 */
export function SpotlightGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={className}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const card = (e.target as HTMLElement).closest<HTMLElement>(".spotlight");
        if (!card || !ref.current?.contains(card)) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}
