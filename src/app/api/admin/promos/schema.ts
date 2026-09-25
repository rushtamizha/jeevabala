import { z } from "zod";
import { safeText } from "@/lib/validation";

export const promoSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,24}$/, "3–24 letters, numbers or dashes"),
    description: safeText(120).optional(),
    discountType: z.enum(["PERCENT", "FLAT"]),
    value: z.number().int().min(1).max(10_000_000),
    maxDiscount: z.number().int().min(0).max(10_000_000).nullish(),
    minFare: z.number().int().min(0).max(100_000_000).nullish(),
    usageLimit: z.number().int().min(1).max(1_000_000).nullish(),
    perCustomerLimit: z.number().int().min(1).max(100).default(1),
    firstRideOnly: z.boolean().default(false),
    startsAt: z.iso.datetime({ offset: true }).nullish(),
    expiresAt: z.iso.datetime({ offset: true }).nullish(),
    isActive: z.boolean().default(true),
  })
  .refine((p) => p.discountType !== "PERCENT" || p.value <= 100, { message: "Percent must be 1–100", path: ["value"] });

export function toPromoRow(p: ReturnType<typeof promoSchema.parse>) {
  return {
    ...p,
    maxDiscount: p.maxDiscount ?? null,
    minFare: p.minFare ?? null,
    usageLimit: p.usageLimit ?? null,
    startsAt: p.startsAt ? new Date(p.startsAt) : null,
    expiresAt: p.expiresAt ? new Date(p.expiresAt) : null,
  };
}
