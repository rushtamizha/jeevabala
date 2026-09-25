import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, type Customer } from "@/db/schema";
import { randomCode } from "./crypto";

async function uniqueReferralCode(name: string): Promise<string> {
  const stem = name
    .normalize("NFKD")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 4)
    .padEnd(3, "X");
  for (let i = 0; i < 6; i++) {
    const code = `${stem}${randomCode(4)}`;
    const [hit] = await db.select({ id: customers.id }).from(customers).where(eq(customers.referralCode, code)).limit(1);
    if (!hit) return code;
  }
  return randomCode(10);
}

/**
 * Called only after the email has been proven via OTP. Existing customers are
 * matched strictly by verified email – a phone number alone never grants access.
 */
export async function findOrCreateVerifiedCustomer(input: {
  email: string;
  name?: string;
  phone?: string;
  referralCode?: string;
}): Promise<{ customer: Customer; isNew: boolean }> {
  const [existing] = await db.select().from(customers).where(eq(customers.email, input.email)).limit(1);
  if (existing) {
    const [updated] = await db
      .update(customers)
      .set({
        lastLoginAt: new Date(),
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
        phone: existing.phone ?? input.phone ?? null,
      })
      .where(eq(customers.id, existing.id))
      .returning();
    return { customer: updated, isNew: false };
  }

  let referredById: string | null = null;
  if (input.referralCode) {
    const [ref] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.referralCode, input.referralCode))
      .limit(1);
    referredById = ref?.id ?? null;
  }
  const name = input.name ?? input.email.split("@")[0];
  const [created] = await db
    .insert(customers)
    .values({
      email: input.email,
      name,
      phone: input.phone ?? null,
      referralCode: await uniqueReferralCode(name),
      referredById,
      emailVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    })
    .onConflictDoNothing({ target: customers.email })
    .returning();
  if (created) return { customer: created, isNew: true };
  // Lost a race with a concurrent verification – read the winner.
  const [again] = await db.select().from(customers).where(eq(customers.email, input.email)).limit(1);
  return { customer: again, isNew: false };
}
