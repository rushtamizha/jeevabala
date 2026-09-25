import "server-only";
import { db, type DbOrTx } from "@/db";
import { auditLogs, type ActorType } from "@/db/schema";

export type AuditInput = {
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
};

const SENSITIVE_KEYS = /pass|secret|token|otp|^pin$|ridepin|apikey|authorization/i;

function scrub(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = SENSITIVE_KEYS.test(k) ? "[redacted]" : v;
  }
  return out;
}

/** Append-only audit trail. Never throws – auditing must not break the main flow. */
export async function audit(input: AuditInput, tx: DbOrTx = db) {
  try {
    await tx.insert(auditLogs).values({
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      meta: scrub(input.meta),
      ip: input.ip?.slice(0, 64),
      userAgent: input.userAgent?.slice(0, 300),
    });
  } catch (err) {
    console.error("[audit] failed to write audit log:", err);
  }
}
