import { z } from "zod";
import { badRequest, param, route } from "@/lib/server/api";
import { audit } from "@/lib/server/audit";
import { saveSetting } from "@/lib/server/settings";
import { SETTINGS_SCHEMAS, type SettingsKey } from "@/lib/settings-schema";

const EDITABLE = ["business", "pricing", "booking", "payment", "loyalty", "notifications", "content"] as const;

export const PUT = route(
  { auth: "admin", body: z.object({ value: z.unknown() }), maxBodyBytes: 64 * 1024 },
  async ({ admin, params, body, ip, userAgent }) => {
    const section = param(params, "section") as SettingsKey;
    if (!(EDITABLE as readonly string[]).includes(section)) throw badRequest("Unknown settings section.");
    const parsed = (SETTINGS_SCHEMAS[section] as z.ZodType).safeParse(body.value);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const i of parsed.error.issues) fields[i.path.join(".")] ??= i.message;
      throw badRequest("Some settings are invalid.", { fields });
    }
    if (section === "loyalty") {
      const tiers = (parsed.data as { tiers: { minRides: number }[] }).tiers;
      if (!tiers.some((t) => t.minRides === 0)) throw badRequest("One loyalty tier must start at 0 rides.");
    }
    const saved = await saveSetting(section, parsed.data as never, admin!.id);
    await audit({ actorType: "ADMIN", actorId: admin!.id, action: `settings.update.${section}`, ip, userAgent });
    return { value: saved };
  },
);
