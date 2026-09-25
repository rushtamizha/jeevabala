import { cn } from "cn";

/**
 * Entrance animations driven purely by CSS keyframes – they run on first paint,
 * before (and without) JavaScript, so above-the-fold content is never hidden.
 */
export function CssBlurText({ text, className, wordClassName, delay = 0, stagger = 70 }: { text: string; className?: string; wordClassName?: string; delay?: number; stagger?: number }) {
  const words = text.split(" ");
  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} aria-hidden className={cn("inline-block animate-blur-in", wordClassName)} style={{ animationDelay: `${delay + i * stagger}ms` }}>
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

export function CssReveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div className={cn("animate-rise-in", className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Word-by-word masked reveal: each word slides up out of its own clip box (CSS only, no hydration wait). */
export function CssMaskedWords({ text, className, wordClassName, delay = 0, stagger = 90 }: { text: string; className?: string; wordClassName?: string; delay?: number; stagger?: number }) {
  const words = text.split(" ").filter(Boolean);
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} aria-hidden className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <span className={cn("inline-block animate-word-up", wordClassName)} style={{ animationDelay: `${delay + i * stagger}ms` }}>
            {w}
          </span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

export function CssFadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div className={cn("animate-fade-up", className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
