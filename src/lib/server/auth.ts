import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { readAdminSession, readCustomerSession } from "./session";

/** Per-request memoised session lookups for Server Components. */
export const getAdminSession = cache(() => readAdminSession());
export const getCustomerSession = cache(() => readCustomerSession());

/** Guard for admin pages. Always call at the top of every admin page (not just the layout). */
export async function requireAdminPage() {
  const s = await getAdminSession();
  if (!s) redirect("/admin/login");
  return s;
}

/** Guard for customer pages. */
export async function requireCustomerPage(returnTo: string) {
  const s = await getCustomerSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return s;
}

/** Only allow same-site relative redirect targets (prevents open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = "/account"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(next)) return fallback;
  if (next.startsWith("/api/") || next.startsWith("/admin")) return fallback;
  return next.slice(0, 300);
}
