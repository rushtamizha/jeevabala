import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/server/crypto";
import { env } from "@/lib/server/env";
import { retryFailedNotifications } from "@/lib/server/notify";
import { purgeOldOtps } from "@/lib/server/otp";
import { purgeExpiredRateLimits } from "@/lib/server/rate-limit";
import { purgeExpiredSessions } from "@/lib/server/session";

/**
 * Maintenance job – call every 5–15 minutes from a scheduler (cron, Vercel Cron…):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-site/api/cron
 */
async function handler(req: NextRequest) {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new NextResponse(null, { status: 401 });
  const retried = await retryFailedNotifications();
  await Promise.all([purgeExpiredSessions(), purgeOldOtps(), purgeExpiredRateLimits()]);
  return NextResponse.json({ ok: true, retried }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = handler;
export const POST = handler;
