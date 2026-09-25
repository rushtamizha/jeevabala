import { NextResponse, type NextRequest } from "next/server";

/**
 * Network-boundary security:
 *  • Strict, nonce-based Content-Security-Policy on every document (blocks XSS/injection).
 *  • Optimistic auth redirects for /admin and /account (real checks happen server-side).
 *  • noindex for private areas.
 */

const isDev = process.env.NODE_ENV === "development";

function buildCsp(nonce: string) {
  const turnstile = process.env.TURNSTILE_SITE_KEY ? " https://challenges.cloudflare.com" : "";
  const https = (process.env.APP_URL ?? "").startsWith("https://");
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}${turnstile}`,
    // React renders `style` attributes (animations); inline *scripts* remain forbidden.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    `frame-src ${turnstile ? turnstile.trim() : "'none'"}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https && !isDev ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}

function hasCookie(req: NextRequest, base: string) {
  return Boolean(req.cookies.get(`__Host-${base}`)?.value || req.cookies.get(base)?.value);
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Optimistic gatekeeping (cookie presence only – no DB). Pages re-verify the session.
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login") && !hasCookie(request, "sa_admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/account") && !hasCookie(request, "sa_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (pathname.startsWith("/admin") || pathname.startsWith("/account") || pathname.startsWith("/login")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|media|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?|ttf|mp3|txt)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
