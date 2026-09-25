/**
 * No page-level entrance animation: fading the whole page in from opacity 0
 * delayed Largest Contentful Paint on every navigation. Sections below the
 * fold reveal themselves with CSS scroll-driven animations instead.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return children;
}
