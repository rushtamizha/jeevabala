import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BellRingIcon, LayoutDashboardIcon, ShieldCheckIcon } from "lucide-react";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { AuthShell } from "@/components/account/auth-shell";
import { getAdminSession } from "@/lib/server/auth";
import { getSetting } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Driver sign in", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin");
  const business = await getSetting("business");
  return (
    <AuthShell
      brand={business.name}
      eyebrow="Driver console"
      title="Run the whole business"
      highlight="from one screen."
      points={[
        { icon: <BellRingIcon className="size-5" />, title: "Live ride requests", text: "Accept, schedule and dispatch the moment a booking lands." },
        { icon: <LayoutDashboardIcon className="size-5" />, title: "Revenue at a glance", text: "Payments, outstanding balances and trip mix, always current." },
        { icon: <ShieldCheckIcon className="size-5" />, title: "Locked down", text: "Rate limiting, lockout and two-factor authentication." },
      ]}
      footnote="Authorised access only · every sign-in is recorded in the activity log"
    >
      <div>
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.03em]">Driver console</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{business.name} · sign in to manage bookings.</p>
        <div className="mt-7">
          <AdminLoginForm />
        </div>
      </div>
    </AuthShell>
  );
}
