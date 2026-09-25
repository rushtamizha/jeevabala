import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { env } from "@/lib/server/env";

const REQUIRED = ["DATABASE_URL", "APP_URL", "APP_SECRET", "ENCRYPTION_KEY"] as const;

/**
 * Liveness/readiness probe. Besides up/down it names the setup step that is
 * missing — setting names only, never values, hosts or error text — so a new
 * deployment can be diagnosed from outside.
 */
export async function GET() {
  const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
  let config = "ok";
  try {
    env();
  } catch {
    config = missing.length ? `missing: ${missing.join(", ")}` : "invalid value (check APP_URL, APP_SECRET ≥ 32 chars, ENCRYPTION_KEY = 64 hex)";
  }

  let database = "ok";
  let migrated: boolean | null = null;
  let seeded: boolean | null = null;
  if (!process.env.DATABASE_URL?.trim()) {
    database = "not configured";
  } else {
    try {
      await db.execute(sql`select 1`);
      const [row] = (await db.execute(sql`select to_regclass('public.settings') is not null as migrated`)).rows as { migrated: boolean }[];
      migrated = Boolean(row?.migrated);
      if (migrated) {
        const [c] = (await db.execute(sql`select count(*)::int as n from cities`)).rows as { n: number }[];
        seeded = Number(c?.n ?? 0) > 0;
      }
    } catch {
      database = "unreachable";
    }
  }

  const ok = config === "ok" && database === "ok" && migrated === true && seeded === true;
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", checks: { config, database, migrated, seeded } },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
