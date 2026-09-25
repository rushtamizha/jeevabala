import { cn } from "cn";

/**
 * React Bits "RotatingText", rebuilt in pure CSS: every word sits in the same
 * grid cell (so the line never reflows) and fades through its own slot. The
 * first word is painted on frame one, so it is safe inside an LCP heading.
 * Supports 3 or 4 words (see `words-3` / `words-4` in globals.css).
 */
export function RotatingText({ words, className, wordClassName }: { words: string[]; className?: string; wordClassName?: string }) {
  const list = words.slice(0, 4);
  if (list.length < 3) return <span className={cn(className, wordClassName)}>{list[0]}</span>;
  return (
    <span className={cn("rotate-words", className)} data-n={list.length}>
      {list.map((w, i) => (
        <span key={w} aria-hidden={i > 0 || undefined} className={cn("whitespace-nowrap", wordClassName)} style={{ ["--i" as string]: i }}>
          {w}
        </span>
      ))}
    </span>
  );
}
