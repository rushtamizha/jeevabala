// Prints fresh secrets for .env – run: npm run secrets:generate
import { randomBytes } from "node:crypto";
console.log(`APP_SECRET=${randomBytes(48).toString("base64url")}`);
console.log(`ENCRYPTION_KEY=${randomBytes(32).toString("hex")}`);
console.log(`CRON_SECRET=${randomBytes(24).toString("hex")}`);
console.log(`TELEGRAM_WEBHOOK_SECRET=${randomBytes(24).toString("hex")}`);
