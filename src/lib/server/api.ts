import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { Admin, Customer } from "@/db/schema";
import { appOrigin, env, isProd } from "./env";
import { memoryRateLimit, rateLimit } from "./rate-limit";
import { clientIpFrom, userAgentFrom } from "./request";
import { readAdminSession, readCustomerSession } from "./session";

/* ----------------------------------------------------------------------------
 * Errors
 * ------------------------------------------------------------------------- */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
    public details?: unknown,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, message, "bad_request", details);
export const unauthorized = (message = "Please sign in to continue.") => new ApiError(401, message, "unauthorized");
export const forbidden = (message = "You don't have access to this resource.") =>
  new ApiError(403, message, "forbidden");
export const notFound = (message = "Not found.") => new ApiError(404, message, "not_found");
export const conflict = (message: string, details?: unknown) => new ApiError(409, message, "conflict", details);
export const unprocessable = (message: string, details?: unknown) =>
  new ApiError(422, message, "unprocessable", details);
export const tooManyRequests = (retryAfterSec: number, message = "Too many requests. Please slow down.") =>
  new ApiError(429, message, "rate_limited", { retryAfterSec }, { "Retry-After": String(retryAfterSec) });

/* ----------------------------------------------------------------------------
 * Route wrapper
 * ------------------------------------------------------------------------- */

type AuthMode = "none" | "admin" | "admin-mfa-pending" | "customer" | "customer-optional";

type RateRule = {
  name: string;
  limit: number;
  windowSec: number;
  /** What to key the limit on. Default: client IP. */
  by?: "ip" | "admin" | "customer" | ((ctx: BaseCtx) => string | null | undefined);
  /** Use the in-memory limiter (per instance) instead of the DB. */
  memory?: boolean;
};

type BaseCtx = {
  req: NextRequest;
  ip: string;
  userAgent: string;
  requestId: string;
  admin: Admin | null;
  adminSessionId: string | null;
  customer: Customer | null;
  customerSessionId: string | null;
};

type Infer<T> = T extends z.ZodType ? z.infer<T> : undefined;

export type RouteCtx<B, Q, P> = BaseCtx & { body: B; query: Q; params: P };

type RouteConfig<B, Q> = {
  auth?: AuthMode;
  body?: B;
  query?: Q;
  rateLimit?: RateRule[];
  /** Max JSON body size in bytes (default 32 KB). */
  maxBodyBytes?: number;
  /** Skip the same-origin (CSRF) check – only for server-to-server webhooks with their own auth. */
  skipOriginCheck?: boolean;
};

type RouteParams = Record<string, string | string[] | undefined>;

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function allowedOrigins(req: NextRequest): Set<string> {
  const set = new Set<string>([appOrigin()]);
  for (const o of (env().ALLOWED_ORIGINS ?? "").split(",")) {
    const trimmed = o.trim();
    if (trimmed) {
      try {
        set.add(new URL(trimmed).origin);
      } catch {
        /* ignore malformed */
      }
    }
  }
  if (!isProd()) {
    const host = req.headers.get("host");
    if (host) {
      set.add(`http://${host}`);
      set.add(`https://${host}`);
    }
  }
  return set;
}

/**
 * CSRF defence: state-changing requests must come from our own origin.
 * Combined with SameSite cookies and the JSON content-type requirement (which
 * forces a CORS preflight that we never approve), cross-site forgery is blocked.
 */
function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin) {
    if (!allowedOrigins(req).has(origin)) throw forbidden("Cross-origin request blocked.");
    return;
  }
  const site = req.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "none") return;
  throw forbidden("Cross-origin request blocked.");
}

async function readBody(req: NextRequest, maxBytes: number): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new ApiError(413, "Request body too large.", "payload_too_large");
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "Content-Type must be application/json.", "unsupported_media_type");
  }
  if (!req.body) return undefined;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new ApiError(413, "Request body too large.", "payload_too_large");
    }
    chunks.push(value);
  }
  if (received === 0) return undefined;
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest("Malformed JSON body.");
  }
}

function zodDetails(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return { fields };
}

function json(data: unknown, status: number, requestId: string, extra?: Record<string, string>) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Request-Id": requestId,
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
}

export function route<B extends z.ZodType | undefined = undefined, Q extends z.ZodType | undefined = undefined>(
  config: RouteConfig<B, Q>,
  handler: (ctx: RouteCtx<Infer<B>, Infer<Q>, RouteParams>) => Promise<unknown>,
) {
  return async (req: NextRequest, routeCtx: { params: Promise<RouteParams> }): Promise<Response> => {
    const requestId = randomUUID();
    try {
      const method = req.method.toUpperCase();
      if (UNSAFE_METHODS.has(method) && !config.skipOriginCheck) assertSameOrigin(req);

      const ip = clientIpFrom(req.headers);
      const userAgent = userAgentFrom(req.headers);
      const base: BaseCtx = {
        req,
        ip,
        userAgent,
        requestId,
        admin: null,
        adminSessionId: null,
        customer: null,
        customerSessionId: null,
      };

      // --- Authentication -------------------------------------------------
      const auth = config.auth ?? "none";
      if (auth === "admin" || auth === "admin-mfa-pending") {
        const s = await readAdminSession({ allowMfaPending: auth === "admin-mfa-pending" });
        if (!s) throw unauthorized();
        if (auth === "admin-mfa-pending" && !s.mfaPending) throw badRequest("No pending verification.");
        base.admin = s.admin;
        base.adminSessionId = s.sessionId;
      } else if (auth === "customer" || auth === "customer-optional") {
        const s = await readCustomerSession();
        if (!s && auth === "customer") throw unauthorized();
        base.customer = s?.customer ?? null;
        base.customerSessionId = s?.sessionId ?? null;
      }

      // --- Rate limiting --------------------------------------------------
      for (const rule of config.rateLimit ?? []) {
        let subject: string | null | undefined;
        if (!rule.by || rule.by === "ip") subject = ip;
        else if (rule.by === "admin") subject = base.admin?.id;
        else if (rule.by === "customer") subject = base.customer?.id ?? ip;
        else subject = rule.by(base);
        if (!subject) continue;
        const key = `${rule.name}:${subject}`;
        const res = rule.memory
          ? memoryRateLimit(key, rule.limit, rule.windowSec)
          : await rateLimit(key, rule.limit, rule.windowSec);
        if (!res.ok) throw tooManyRequests(res.retryAfterSec);
      }

      // --- Input ----------------------------------------------------------
      let body: unknown = undefined;
      if (config.body) {
        const raw = await readBody(req, config.maxBodyBytes ?? 32 * 1024);
        const parsed = (config.body as z.ZodType).safeParse(raw ?? {});
        if (!parsed.success) throw unprocessable("Please check the highlighted fields.", zodDetails(parsed.error));
        body = parsed.data;
      }
      let query: unknown = undefined;
      if (config.query) {
        const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
        const parsed = (config.query as z.ZodType).safeParse(raw);
        if (!parsed.success) throw badRequest("Invalid query parameters.", zodDetails(parsed.error));
        query = parsed.data;
      }
      const params = (await routeCtx.params) ?? {};

      const result = await handler({ ...base, body, query, params } as RouteCtx<Infer<B>, Infer<Q>, RouteParams>);
      if (result instanceof Response) {
        result.headers.set("X-Request-Id", requestId);
        if (!result.headers.has("Cache-Control")) result.headers.set("Cache-Control", "no-store, max-age=0");
        return result;
      }
      return json(result ?? { ok: true }, 200, requestId);
    } catch (err) {
      if (err instanceof ApiError) {
        return json(
          { error: { code: err.code, message: err.message, details: err.details } },
          err.status,
          requestId,
          err.headers,
        );
      }
      console.error(`[api] ${req.method} ${req.nextUrl.pathname} failed (request ${requestId}):`, err);
      return json(
        { error: { code: "internal", message: "Something went wrong. Please try again.", requestId } },
        500,
        requestId,
      );
    }
  };
}

/** Helper to read a single string route param. */
export function param(params: RouteParams, name: string): string {
  const v = params[name];
  if (typeof v !== "string" || v.length === 0 || v.length > 64) throw notFound();
  return v;
}
