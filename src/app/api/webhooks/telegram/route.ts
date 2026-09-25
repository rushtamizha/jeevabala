import { and, asc, count, eq, gte, inArray, lt, sum } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { ApiError } from "@/lib/server/api";
import { performAdminAction } from "@/lib/server/admin-actions";
import { safeEqual } from "@/lib/server/crypto";
import { absoluteUrl } from "@/lib/server/env";
import { answerCallback, editTelegramMessage, sendTelegramMessage, tgEscape } from "@/lib/server/notify/telegram";
import { memoryRateLimit } from "@/lib/server/rate-limit";
import { getIntegrations, getSetting } from "@/lib/server/settings";
import { formatDateTime, formatINR } from "@/lib/format";
import { TRIP_TYPE_LABEL } from "@/lib/types";
import { wallDate, wallTimeToUtc } from "@/lib/time";

type Update = {
  message?: { chat: { id: number }; from?: { id: number }; text?: string };
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: { message_id: number; chat: { id: number }; text?: string };
  };
};

const ok = () => NextResponse.json({ ok: true });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function POST(req: NextRequest) {
  const integ = await getIntegrations();
  const tg = integ.telegram;
  if (!tg.configured || !tg.webhookEnabled || !tg.webhookSecret) return new NextResponse(null, { status: 404 });

  // Authenticate Telegram via the secret token registered with setWebhook.
  const provided = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!safeEqual(provided, tg.webhookSecret)) return new NextResponse(null, { status: 401 });
  if (!memoryRateLimit("tgwebhook", 120, 60).ok) return new NextResponse(null, { status: 429 });

  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > 64 * 1024) return ok();
  let update: Update;
  try {
    update = (await req.json()) as Update;
  } catch {
    return ok();
  }

  const token = tg.botToken!;
  const adminChat = String(tg.chatId);

  try {
    if (update.callback_query) {
      const cb = update.callback_query;
      // Only the registered admin chat may act.
      if (String(cb.from.id) !== adminChat && String(cb.message?.chat.id) !== adminChat) {
        await answerCallback(token, cb.id, "Not authorised.", true);
        return ok();
      }
      const [verb, id] = (cb.data ?? "").split(":");
      if (!id || !UUID.test(id)) {
        await answerCallback(token, cb.id, "Unknown action.");
        return ok();
      }
      const actor = { type: "TELEGRAM" as const, id: null };
      try {
        let label = "";
        if (verb === "acc") {
          await performAdminAction(id, { action: "accept" }, actor);
          label = "✅ Accepted — customer notified";
        } else if (verb === "rej") {
          await performAdminAction(id, { action: "reject", reason: "Driver unavailable at this time" }, actor);
          label = "❌ Declined — customer notified";
        } else if (verb === "paid") {
          const [b] = await db.select({ method: bookings.paymentMethod }).from(bookings).where(eq(bookings.id, id)).limit(1);
          await performAdminAction(id, { action: "payment", method: b?.method ?? "UPI" }, actor);
          label = "💰 Marked as paid";
        } else {
          await answerCallback(token, cb.id, "Unknown action.");
          return ok();
        }
        await answerCallback(token, cb.id, label);
        if (cb.message) {
          const original = tgEscape(cb.message.text ?? "");
          await editTelegramMessage(token, cb.message.chat.id, cb.message.message_id, `${original}\n\n<b>${tgEscape(label)}</b>`, [
            [{ text: "Open booking ↗", url: absoluteUrl(`/admin/bookings/${id}`) }],
          ]).catch(() =>
            editTelegramMessage(token, cb.message!.chat.id, cb.message!.message_id, `${original}\n\n<b>${tgEscape(label)}</b>`),
          );
        }
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Action failed. Please use the dashboard.";
        await answerCallback(token, cb.id, msg, true);
      }
      return ok();
    }

    const msg = update.message;
    if (msg?.text && String(msg.chat.id) === adminChat) {
      const cmd = msg.text.trim().split(/\s+/)[0].toLowerCase().replace(/@.*$/, "");
      await sendTelegramMessage(token, adminChat, await commandReply(cmd));
    }
  } catch (err) {
    console.error("[telegram] webhook error:", err);
  }
  return ok();
}

async function commandReply(cmd: string): Promise<string> {
  const business = await getSetting("business");
  const tz = business.timezone;
  if (cmd === "/pending") {
    const rows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.status, "PENDING"))
      .orderBy(asc(bookings.pickupAt))
      .limit(10);
    if (!rows.length) return "🎉 No pending requests.";
    return [
      `<b>⏳ ${rows.length} pending request${rows.length > 1 ? "s" : ""}</b>`,
      ...rows.map(
        (b) =>
          `\n<code>${tgEscape(b.code)}</code> · ${tgEscape(TRIP_TYPE_LABEL[b.tripType])}\n🗓 ${tgEscape(formatDateTime(b.pickupAt, tz, "short"))}\n📍 ${tgEscape(b.pickupAddress.slice(0, 80))}\n💰 ${tgEscape(formatINR(b.fareEstimate))}`,
      ),
    ].join("\n");
  }
  if (cmd === "/today") {
    const today = wallDate(new Date(), tz);
    const start = wallTimeToUtc(`${today}T00:00`, tz);
    const end = new Date(start.getTime() + 86_400_000);
    const rows = await db
      .select()
      .from(bookings)
      .where(
        and(
          gte(bookings.pickupAt, start),
          lt(bookings.pickupAt, end),
          inArray(bookings.status, ["CONFIRMED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED"]),
        ),
      )
      .orderBy(asc(bookings.pickupAt));
    if (!rows.length) return "📭 No rides scheduled today.";
    return [
      `<b>🗓 Today · ${rows.length} ride${rows.length > 1 ? "s" : ""}</b>`,
      ...rows.map(
        (b) =>
          `\n${tgEscape(formatDateTime(b.pickupAt, tz, "time"))} · <code>${tgEscape(b.code)}</code> · ${tgEscape(b.status)}\n👤 ${tgEscape(b.contactName)} · ${tgEscape(b.contactPhone)}\n📍 ${tgEscape(b.pickupAddress.slice(0, 80))}`,
      ),
    ].join("\n");
  }
  if (cmd === "/stats") {
    const monthStart = wallTimeToUtc(`${wallDate(new Date(), tz).slice(0, 8)}01T00:00`, tz);
    const [m] = await db
      .select({ rides: count(), revenue: sum(bookings.finalFare) })
      .from(bookings)
      .where(and(eq(bookings.status, "COMPLETED"), gte(bookings.completedAt, monthStart)));
    const [unpaid] = await db
      .select({ n: count(), amount: sum(bookings.finalFare) })
      .from(bookings)
      .where(and(eq(bookings.status, "COMPLETED"), inArray(bookings.paymentStatus, ["UNPAID", "CLAIMED"])));
    return [
      "<b>📊 This month</b>",
      `Completed rides: <b>${Number(m?.rides ?? 0)}</b>`,
      `Revenue: <b>${tgEscape(formatINR(Number(m?.revenue ?? 0)))}</b>`,
      `Outstanding: <b>${tgEscape(formatINR(Number(unpaid?.amount ?? 0)))}</b> (${Number(unpaid?.n ?? 0)} trips)`,
    ].join("\n");
  }
  return [
    `<b>${tgEscape(business.name)} · Driver bot</b>`,
    "You'll receive new ride requests here with one-tap Accept / Decline.",
    "",
    "/pending – requests awaiting you",
    "/today – today's schedule",
    "/stats – earnings snapshot",
  ].join("\n");
}
