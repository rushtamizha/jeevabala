/** Typed fetch wrapper for our JSON API (client-side). */

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
    public fields: Record<string, string> = {},
    public retryAfterSec?: number,
  ) {
    super(message);
  }
}

type Options = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; signal?: AbortSignal };

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: {
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiClientError(0, "You appear to be offline. Check your connection and try again.", "network");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const e = (data as { error?: { message?: string; code?: string; details?: { fields?: Record<string, string>; retryAfterSec?: number } } })?.error;
    throw new ApiClientError(
      res.status,
      e?.message ?? (res.status === 401 ? "Please sign in to continue." : "Something went wrong. Please try again."),
      e?.code ?? "error",
      e?.details?.fields ?? {},
      e?.details?.retryAfterSec,
    );
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error && err.name !== "AbortError") return "Something went wrong. Please try again.";
  return "Something went wrong. Please try again.";
}
