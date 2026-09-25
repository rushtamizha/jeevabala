import { route } from "@/lib/server/api";
import { revokeCurrentSession } from "@/lib/server/session";

export const POST = route({}, async () => {
  await revokeCurrentSession("CUSTOMER");
  return { ok: true };
});
