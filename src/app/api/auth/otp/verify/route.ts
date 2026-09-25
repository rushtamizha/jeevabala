import { ApiError, forbidden, route, tooManyRequests } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { findOrCreateVerifiedCustomer } from "@/lib/server/customers";
import { verifyOtp } from "@/lib/server/otp";
import { rateLimit } from "@/lib/server/rate-limit";
import { createSession, revokeCurrentSession } from "@/lib/server/session";
import { otpVerifySchema } from "@/lib/validation";

export const POST = route(
  {
    body: otpVerifySchema,
    rateLimit: [{ name: "otpver:ip", limit: 25, windowSec: 900 }],
  },
  async ({ body, ip, userAgent }) => {
    const perEmail = await rateLimit(`otpver:email:${body.email}`, 12, 900);
    if (!perEmail.ok) throw tooManyRequests(perEmail.retryAfterSec, "Too many attempts. Please request a new code later.");

    const result = await verifyOtp(body.email, body.code);
    if (!result.ok) {
      const message =
        result.reason === "locked"
          ? "Too many incorrect attempts. Please request a new code."
          : result.reason === "expired"
            ? "This code has expired. Please request a new one."
            : "That code isn’t right. Please check and try again.";
      throw new ApiError(400, message, `otp_${result.reason}`, { fields: { code: message } });
    }

    const { customer, isNew } = await findOrCreateVerifiedCustomer({
      email: body.email,
      name: body.name,
      phone: body.phone,
      referralCode: body.referralCode,
    });
    if (customer.status === "BLOCKED" || customer.deletedAt) {
      throw forbidden("This account is not available. Please contact support.");
    }

    // Session fixation defence: always issue a brand-new session after authentication.
    await revokeCurrentSession("CUSTOMER");
    await createSession({ kind: "CUSTOMER", subjectId: customer.id, ip, userAgent });
    await audit({ actorType: "CUSTOMER", actorId: customer.id, action: isNew ? "customer.signup" : "customer.login", ip, userAgent });

    return {
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        rewardBalance: customer.rewardBalance,
      },
      isNew,
    };
  },
);
