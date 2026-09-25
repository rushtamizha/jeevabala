import "server-only";
import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

export type RateLimitResult = { ok: boolean; remaining: number; resetAt: Date; retryAfterSec: number };

/**
 * Fixed-window rate limiter backed by PostgreSQL – correct across multiple app
 * instances / serverless invocations. One atomic UPSERT per check.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const result = await db.execute<{ count: number; reset_at: Date }>(sql`
    INSERT INTO ${rateLimits} (key, count, reset_at)
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSec}))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN ${rateLimits.resetAt} <= now() THEN 1 ELSE ${rateLimits.count} + 1 END,
      reset_at = CASE WHEN ${rateLimits.resetAt} <= now()
        THEN now() + make_interval(secs => ${windowSec})
        ELSE ${rateLimits.resetAt} END
    RETURNING count, reset_at
  `);
  const row = result.rows[0];
  const count = Number(row.count);
  const resetAt = new Date(row.reset_at);
  const retryAfterSec = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
  return { ok: count <= limit, remaining: Math.max(0, limit - count), resetAt, retryAfterSec };
}

/** Reset a key (e.g. after a successful login). */
export async function resetRateLimit(key: string) {
  await db.execute(sql`DELETE FROM ${rateLimits} WHERE key = ${key}`);
}

export async function purgeExpiredRateLimits() {
  await db.delete(rateLimits).where(lt(rateLimits.resetAt, sql`now() - interval '1 hour'`));
}

/* ----------------------------------------------------------------------------
 * In-memory limiter for very high-frequency, low-risk endpoints (e.g. address
 * autocomplete). Per-instance only – a cheap first line of defence.
 * ------------------------------------------------------------------------- */

type Bucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, Bucket>();
let lastSweep = Date.now();

export function memoryRateLimit(key: string, limit: number, windowSec: number): RateLimitResult {
  const now = Date.now();
  if (now - lastSweep > 60_000 || memoryBuckets.size > 50_000) {
    for (const [k, b] of memoryBuckets) if (b.resetAt <= now) memoryBuckets.delete(k);
    lastSweep = now;
  }
  let bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowSec * 1000 };
    memoryBuckets.set(key, bucket);
  }
  bucket.count++;
  return {
    ok: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: new Date(bucket.resetAt),
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}
