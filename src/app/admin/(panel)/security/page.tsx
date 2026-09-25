import type { Metadata } from "next";
import { PasswordPanel, SessionsPanel, TwoFactorPanel } from "@/components/admin/security-panels";
import { Panel } from "@/components/admin/form-kit";
import { requireAdminPage } from "@/lib/server/auth";
import { listAdminSessions } from "@/lib/server/session";
import { formatDateTime } from "@/lib/format";
import { getSetting } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  const { admin, sessionId } = await requireAdminPage();
  const [sessions, business] = await Promise.all([listAdminSessions(admin.id), getSetting("business")]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">Security</h1>
        <p className="text-sm text-muted-foreground">
          Last sign-in {admin.lastLoginAt ? formatDateTime(admin.lastLoginAt, business.timezone, "short") : "—"}{admin.lastLoginIp ? ` from ${admin.lastLoginIp}` : ""}.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Two-factor authentication" description="Authenticator app codes (TOTP) with single-use recovery codes.">
          <TwoFactorPanel enabled={admin.totpEnabled} recoveryLeft={admin.recoveryCodes.length} />
        </Panel>
        <Panel title="Password" description="Stored as a salted scrypt hash. Changing it signs out every other device.">
          <PasswordPanel />
        </Panel>
      </div>
      <Panel title="Active sessions" description="Devices currently signed in to the driver console.">
        <SessionsPanel
          currentId={sessionId}
          sessions={sessions.map((s) => ({ id: s.id, ip: s.ip, userAgent: s.userAgent, lastSeenAt: s.lastSeenAt.toISOString(), createdAt: s.createdAt.toISOString() }))}
        />
      </Panel>
    </div>
  );
}
