/**
 * Create or reset the admin (driver) account – interactive, so the password never
 * lands in shell history.  Usage: npm run admin:create
 * Non-interactive (CI): ADMIN_EMAIL=… ADMIN_NAME=… ADMIN_PASSWORD=… npm run admin:create
 */
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";

loadEnvConfig(process.cwd());

async function prompt(question: string, hidden = false): Promise<string> {
  const muted = new Writable({
    write(chunk, _enc, cb) {
      if (!hidden) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
  process.stdout.write(question);
  const answer = await new Promise<string>((resolve) => rl.question("", resolve));
  rl.close();
  if (hidden) process.stdout.write("\n");
  return answer.trim();
}

async function main() {
  const { db, closeDb } = await import("../src/db");
  const { admins, sessions } = await import("../src/db/schema");
  const { hashPassword, checkPasswordPolicy } = await import("../src/lib/server/crypto");

  const email = (process.env.ADMIN_EMAIL ?? (await prompt("Admin email: "))).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
  const name = process.env.ADMIN_NAME ?? ((await prompt("Full name (shown to customers as the driver): ")) || "Admin");

  let password = process.env.ADMIN_PASSWORD ?? "";
  for (;;) {
    if (!password) password = await prompt("Password (min 12 chars, hidden): ", true);
    const policy = checkPasswordPolicy(password, [email, name]);
    if (policy.ok) break;
    console.log(`  ✖ ${policy.reason}`);
    if (process.env.ADMIN_PASSWORD) process.exit(1);
    password = "";
  }
  if (!process.env.ADMIN_PASSWORD) {
    const confirm = await prompt("Confirm password: ", true);
    if (confirm !== password) throw new Error("Passwords do not match");
  }

  const passwordHash = await hashPassword(password);
  const [existing] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
  if (existing) {
    await db
      .update(admins)
      .set({ passwordHash, name, failedLogins: 0, lockedUntil: null, passwordChangedAt: new Date() })
      .where(eq(admins.id, existing.id));
    await db.delete(sessions).where(eq(sessions.adminId, existing.id));
    console.log(`✔ Password reset for ${email}. All existing sessions were signed out.`);
  } else {
    await db.insert(admins).values({ email, name, passwordHash });
    console.log(`✔ Admin ${email} created. Sign in at /admin/login and enable two-factor authentication.`);
  }
  await closeDb();
}

main().catch((err) => {
  console.error("✖", err instanceof Error ? err.message : err);
  process.exit(1);
});
