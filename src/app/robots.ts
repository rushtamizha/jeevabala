import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/lib/server/env";

export default function robots(): MetadataRoute.Robots {
  const base = safeBase();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/api/", "/login"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}

function safeBase() {
  try {
    return publicBaseUrl();
  } catch {
    return "http://localhost:3000";
  }
}
