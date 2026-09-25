import type { Metadata } from "next";
import { count, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminMobileNav, AdminTopbar } from "@/components/admin/admin-topbar";
import { LiveProvider } from "@/components/admin/live-provider";
import { MotionProvider } from "@/components/providers/motion-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { requireAdminPage } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/settings";

export const metadata: Metadata = { title: { default: "Driver console", template: "%s · Driver console" }, robots: { index: false, follow: false } };

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdminPage();
  const [s, [pending], [claims], jar] = await Promise.all([
    getSettings(),
    db.select({ n: count() }).from(bookings).where(eq(bookings.status, "PENDING")),
    db.select({ n: count() }).from(bookings).where(eq(bookings.paymentStatus, "CLAIMED")),
    cookies(),
  ]);
  const defaultOpen = jar.get("sidebar_state")?.value !== "false";
  return (
    <MotionProvider>
      <LiveProvider initial={{ pending: Number(pending?.n ?? 0), paymentClaims: Number(claims?.n ?? 0) }}>
        <SidebarProvider defaultOpen={defaultOpen} className="bg-sidebar">
          <AdminSidebar brand={s.business.name} adminName={admin.name} accepting={s.booking.acceptingBookings} />
          <SidebarInset className="min-w-0 bg-surface md:peer-data-[variant=inset]:rounded-2xl">
            <AdminTopbar adminName={admin.name} adminEmail={admin.email} accepting={s.booking.acceptingBookings} />
            <div className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-5 pb-24 sm:px-6 sm:py-7 md:pb-8 lg:px-8">
              <div className="animate-rise-in">{children}</div>
            </div>
          </SidebarInset>
          <AdminMobileNav />
        </SidebarProvider>
      </LiveProvider>
    </MotionProvider>
  );
}
