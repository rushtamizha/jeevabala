/**
 * SERP-safe titles and descriptions.
 * Titles are emitted as `absolute` so the layout template never appends the brand twice;
 * the brand is appended here only when it still fits Google's ~60 character budget.
 */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

export function seoTitle(base: string, brand?: string): { absolute: string } {
  const clean = base.replace(/\s+/g, " ").trim();
  if (brand && clean.length + brand.length + 3 <= TITLE_MAX) return { absolute: `${clean} | ${brand}` };
  return { absolute: clean };
}

/** Trim to the last whole word under the limit so descriptions are never cut mid-word. */
export function metaDescription(text: string, max = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : cut.length).replace(/[,;:\-–—\s]+$/, "")}…`;
}
