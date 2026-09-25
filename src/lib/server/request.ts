import "server-only";
import { headers } from "next/headers";
import { env } from "./env";

const IP_RE = /^[0-9a-fA-F:.]{2,45}$/;

function sanitizeIp(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  let v = value.trim();
  // Strip IPv4 port and IPv6 brackets.
  if (v.startsWith("[")) v = v.slice(1, v.indexOf("]") > 0 ? v.indexOf("]") : undefined);
  else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(v)) v = v.split(":")[0];
  if (v.startsWith("::ffff:")) v = v.slice(7);
  return IP_RE.test(v) ? v : undefined;
}

/**
 * Resolve the client IP. Only proxy headers we have been told to trust are used,
 * so a client cannot spoof its address to dodge rate limits.
 */
export function clientIpFrom(h: Headers): string {
  const cfg = env();
  if (cfg.TRUST_CLOUDFLARE) {
    const cf = sanitizeIp(h.get("cf-connecting-ip"));
    if (cf) return cf;
  }
  const hops = cfg.TRUSTED_PROXY_HOPS;
  const xff = h.get("x-forwarded-for");
  if (xff && hops > 0) {
    const chain = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // The right-most `hops` entries were appended by our trusted proxies;
    // the entry just before them is what the outermost trusted proxy saw.
    const candidate = sanitizeIp(chain[Math.max(0, chain.length - hops)]);
    if (candidate) return candidate;
  }
  return sanitizeIp(h.get("x-real-ip")) ?? "0.0.0.0";
}

export function userAgentFrom(h: Headers): string {
  return (h.get("user-agent") ?? "").slice(0, 300);
}

export async function requestMeta(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  return { ip: clientIpFrom(h), userAgent: userAgentFrom(h) };
}
