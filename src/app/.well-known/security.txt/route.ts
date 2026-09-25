import { getSetting } from "@/lib/server/settings";

/** RFC 9116 security contact. */
export async function GET() {
  const b = await getSetting("business").catch(() => null);
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const expires = new Date(Date.now() + 180 * 86_400_000).toISOString();
  const contact = b?.email ? `mailto:${b.email}` : `${base}/`;
  const body = [`Contact: ${contact}`, `Expires: ${expires}`, "Preferred-Languages: en", `Canonical: ${base}/.well-known/security.txt`, `Policy: ${base}/privacy`].join("\n");
  return new Response(`${body}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
