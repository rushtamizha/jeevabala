import { ApiError, badRequest, route, tooManyRequests } from "@/lib/server/api";
import { requestOtp } from "@/lib/server/otp";
import { rateLimit } from "@/lib/server/rate-limit";
import { verifyTurnstile } from "@/lib/server/turnstile";
import { otpRequestSchema } from "@/lib/validation";

export const POST = route(
  {
    body: otpRequestSchema,
    rateLimit: [
      { name: "otpreq:ip:15m", limit: 8, windowSec: 900 },
      { name: "otpreq:ip:1d", limit: 40, windowSec: 86400 },
    ],
  },
  async ({ body, ip }) => {
    if (body.website) throw badRequest("Invalid request.");
    if (!(await verifyTurnstile(body.turnstileToken, ip))) throw badRequest("Please complete the security check.");

    // Per-email throttle prevents inbox flooding regardless of source IP.
    const perEmail = await rateLimit(`otpreq:email:${body.email}`, 5, 3600);
    if (!perEmail.ok) throw tooManyRequests(perEmail.retryAfterSec, "Too many codes requested for this email. Try again later.");

    const result = await requestOtp(body.email, ip);
    if (!result.ok && result.reason === "cooldown") {
      throw tooManyRequests(result.resendInSec, `Please wait ${result.resendInSec}s before requesting a new code.`);
    }
    if (!result.ok) {
      throw new ApiError(503, "Email verification is temporarily unavailable. Please call us to book.", "otp_unavailable");
    }
    return { sent: true, resendInSec: result.resendInSec, maskedEmail: result.maskedEmail, devHint: result.devHint };
  },
);
