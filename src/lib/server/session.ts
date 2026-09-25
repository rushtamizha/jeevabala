import "server-only";
import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { admins, customers, sessions, type Admin, type Customer } from "@/db/schema";
import { randomToken, sha256Hex } from "./crypto";
import { isProd } from "./env";

export type SessionKind = "ADMIN" | "CUSTOMER";

type SessionPolicy = {
  /** Session is invalid after this long without activity. */
  idleMs: number;
  /** Hard cap on session lifetime regardless of activity. */
  absoluteMs: number;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const SESSION_POLICY: Record<SessionKind, SessionPolicy> = {
  ADMIN: { idleMs: 3 * DAY, absoluteMs: 30 * DAY },
  CUSTOMER: { idleMs: 90 * DAY, absoluteMs: 365 * DAY },
};

/** Short window to finish the second factor after a correct password. */
const MFA_PENDING_MS = 5 * 60 * 1000;
/** Throttle `last_seen_at` writes. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * `__Host-` cookies are pinned to this exact origin, HTTPS only, path=/ and cannot be
 * set by sub-domains – the strongest cookie scoping browsers offer.
 */
export function cookieName(kind: SessionKind): string {
  const base = kind === "ADMIN" ? "sa_admin" : "sa_session";
  return isProd() ? `__Host-${base}` : base;
}

export const ADMIN_COOKIE_BASENAME = "sa_admin";
export const CUSTOMER_COOKIE_BASENAME = "sa_session";

async function setSessionCookie(kind: SessionKind, token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set({
    name: cookieName(kind),
    value: token,
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

export async function clearSessionCookie(kind: SessionKind) {
  const jar = await cookies();
  jar.set({
    name: cookieName(kind),
    value: "",
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

type CreateSessionInput = {
  kind: SessionKind;
  subjectId: string;
  ip?: string;
  userAgent?: string;
  mfaPending?: boolean;
};

/** Creates a session row + cookie. The raw token is never stored server-side. */
export async function createSession(input: CreateSessionInput): Promise<void> {
  const token = randomToken(32);
  const id = sha256Hex(token);
  const policy = SESSION_POLICY[input.kind];
  const expiresAt = new Date(Date.now() + (input.mfaPending ? MFA_PENDING_MS : policy.absoluteMs));
  await db.insert(sessions).values({
    id,
    kind: input.kind,
    adminId: input.kind === "ADMIN" ? input.subjectId : null,
    customerId: input.kind === "CUSTOMER" ? input.subjectId : null,
    mfaPending: input.mfaPending ?? false,
    ip: input.ip?.slice(0, 64),
    userAgent: input.userAgent?.slice(0, 300),
    expiresAt,
  });
  await setSessionCookie(input.kind, token, expiresAt);
}

async function readSessionId(kind: SessionKind): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(cookieName(kind))?.value;
  if (!token || token.length < 20 || token.length > 100) return null;
  return sha256Hex(token);
}

export type AdminSession = { sessionId: string; admin: Admin; mfaPending: boolean };
export type CustomerSession = { sessionId: string; customer: Customer };

function isAlive(row: { lastSeenAt: Date; expiresAt: Date }, kind: SessionKind) {
  const now = Date.now();
  if (row.expiresAt.getTime() <= now) return false;
  if (now - row.lastSeenAt.getTime() > SESSION_POLICY[kind].idleMs) return false;
  return true;
}

async function touch(id: string, lastSeenAt: Date) {
  if (Date.now() - lastSeenAt.getTime() < TOUCH_INTERVAL_MS) return;
  await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, id));
}

export async function readAdminSession(opts: { allowMfaPending?: boolean } = {}): Promise<AdminSession | null> {
  const id = await readSessionId("ADMIN");
  if (!id) return null;
  const [row] = await db
    .select({ session: sessions, admin: admins })
    .from(sessions)
    .innerJoin(admins, eq(sessions.adminId, admins.id))
    .where(and(eq(sessions.id, id), eq(sessions.kind, "ADMIN")))
    .limit(1);
  if (!row || !isAlive(row.session, "ADMIN")) return null;
  if (row.session.mfaPending && !opts.allowMfaPending) return null;
  // Sessions issued before the last password change are invalid.
  if (row.session.createdAt < row.admin.passwordChangedAt) return null;
  await touch(id, row.session.lastSeenAt);
  return { sessionId: id, admin: row.admin, mfaPending: row.session.mfaPending };
}

export async function readCustomerSession(): Promise<CustomerSession | null> {
  const id = await readSessionId("CUSTOMER");
  if (!id) return null;
  const [row] = await db
    .select({ session: sessions, customer: customers })
    .from(sessions)
    .innerJoin(customers, eq(sessions.customerId, customers.id))
    .where(and(eq(sessions.id, id), eq(sessions.kind, "CUSTOMER")))
    .limit(1);
  if (!row || !isAlive(row.session, "CUSTOMER")) return null;
  if (row.customer.deletedAt || row.customer.status === "BLOCKED") return null;
  await touch(id, row.session.lastSeenAt);
  return { sessionId: id, customer: row.customer };
}

export async function revokeCurrentSession(kind: SessionKind) {
  const id = await readSessionId(kind);
  if (id) await db.delete(sessions).where(eq(sessions.id, id));
  await clearSessionCookie(kind);
}

export async function revokeSessionById(id: string) {
  await db.delete(sessions).where(eq(sessions.id, id));
}

export async function revokeAllAdminSessions(adminId: string, exceptSessionId?: string) {
  await db
    .delete(sessions)
    .where(
      exceptSessionId
        ? and(eq(sessions.adminId, adminId), ne(sessions.id, exceptSessionId))
        : eq(sessions.adminId, adminId),
    );
}

export async function revokeAllCustomerSessions(customerId: string) {
  await db.delete(sessions).where(eq(sessions.customerId, customerId));
}

export async function listAdminSessions(adminId: string) {
  return db
    .select({
      id: sessions.id,
      ip: sessions.ip,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(
      and(eq(sessions.adminId, adminId), eq(sessions.mfaPending, false), gt(sessions.expiresAt, new Date())),
    )
    .orderBy(sql`${sessions.lastSeenAt} desc`);
}

export async function purgeExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
