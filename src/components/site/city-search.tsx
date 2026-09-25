"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Instant filter for the server-rendered city directory: every card stays in
 * the HTML for crawlers; typing just hides non-matching cards and empty groups.
 */
export function CitySearch({ total }: { total: number }) {
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(total);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = q.trim().toLowerCase();
    const seen = new Set<string>();
    document.querySelectorAll<HTMLElement>("[data-city-group]").forEach((group) => {
      let visible = 0;
      group.querySelectorAll<HTMLElement>("[data-city]").forEach((card) => {
        const name = card.dataset.city ?? "";
        const match = !term || name.includes(term);
        (card.parentElement as HTMLElement).hidden = !match;
        if (match) {
          visible++;
          seen.add(name);
        }
      });
      group.hidden = visible === 0;
    });
    const id = requestAnimationFrame(() => setShown(seen.size));
    return () => cancelAnimationFrame(id);
  }, [q]);

  return (
    <div className="sticky top-[84px] z-30 -mx-1 mb-2 px-1 py-2">
      <label className="relative flex h-12 items-center rounded-full border bg-card/95 shadow-premium backdrop-blur-xl focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
        <SearchIcon className="ml-4 size-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Search cities</span>
        <input
          ref={ref}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${total} cities — e.g. Salem, Ooty, Rameswaram`}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none placeholder:text-muted-foreground"
        />
        {q ? (
          <button type="button" aria-label="Clear search" onClick={() => { setQ(""); ref.current?.focus(); }} className="mr-1.5 grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary">
            <XIcon className="size-4" />
          </button>
        ) : (
          <span className="mr-4 text-xs font-medium tabular text-muted-foreground">{shown}</span>
        )}
      </label>
      {q && shown === 0 && <p className="mt-3 text-center text-sm text-muted-foreground">No city matches “{q}”. Book anyway — we drive anywhere in Tamil Nadu.</p>}
    </div>
  );
}
