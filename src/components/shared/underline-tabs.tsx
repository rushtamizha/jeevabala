"use client";

import { cn } from "cn";
import { AnimatePresence, motion } from "framer-motion";
import { useId, useState } from "react";

/** Underline tabs with a sliding indicator and cross-fading panels (reference style). */
export function UnderlineTabs({ tabs, initial, className }: { tabs: { id: string; label: string; count?: number; content: React.ReactNode }[]; initial?: string; className?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  const uid = useId();
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div className={className}>
      <div role="tablist" className="flex border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={cn("relative flex-1 pb-3 pt-1 text-sm font-medium transition-colors", active === t.id ? "text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{t.count}</span>}
            {active === t.id && <motion.span layoutId={`${uid}-underline`} className="absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-primary" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current?.id}
          role="tabpanel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="pt-5"
        >
          {current?.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
