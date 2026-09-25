import type { Metadata } from "next";
import { ShieldCheckIcon } from "lucide-react";
import { IntegrationsForm } from "@/components/admin/integrations-form";
import { requireAdminPage } from "@/lib/server/auth";
import { env } from "@/lib/server/env";
import { getIntegrationsForAdmin } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  await requireAdminPage();
  const view = await getIntegrationsForAdmin();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">Integrations</h1>
        <p className="text-sm text-muted-foreground">Connect the channels you use. Whatever is connected is used automatically — nothing else is required.</p>
      </div>
      <p className="flex items-start gap-2 rounded-xl border border-success/40 bg-success/[0.05] p-3 text-sm">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
        Tokens and passwords are encrypted with AES-256-GCM before storage and are never sent back to the browser.
      </p>
      <IntegrationsForm initial={view} appUrlIsHttps={env().APP_URL.startsWith("https://")} />
    </div>
  );
}
