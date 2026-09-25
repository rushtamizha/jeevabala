"use client";

import { BellIcon, BellOffIcon, CalendarDaysIcon, ClipboardListIcon, LayoutDashboardIcon, LogOutIcon, MenuIcon, ShieldCheckIcon, UserRoundIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "cn";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { api } from "@/lib/api-client";
import { formatRelative, initials } from "@/lib/format";
import { useLiveCounts } from "./live-provider";

export function AdminTopbar({ adminName, adminEmail, accepting }: { adminName: string; adminEmail: string; accepting: boolean }) {
  const live = useLiveCounts();
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-surface/85 px-3 backdrop-blur-xl sm:px-5 md:rounded-t-2xl">
      <SidebarTrigger className="-ml-1 rounded-xl" />
      <div className="mx-1 h-5 w-px bg-border" />
      <span className="hidden text-sm font-semibold md:inline">Driver console</span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium md:hidden",
          accepting ? "bg-success/12 text-success dark:text-success" : "bg-primary/12 text-primary dark:text-primary",
        )}
      >
        <span className={cn("size-1.5 rounded-full", accepting ? "bg-success" : "bg-primary")} />
        {accepting ? "Accepting bookings" : "Bookings paused"}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Popover onOpenChange={(o) => o && live.unread > 0 && live.markSeen()}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
              <BellIcon />
              {live.unread > 0 && (
                <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {live.unread}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold">Activity</p>
              <button type="button" onClick={() => live.setSoundOn(!live.soundOn)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                {live.soundOn ? <BellIcon className="size-3.5" /> : <BellOffIcon className="size-3.5" />} Sound {live.soundOn ? "on" : "off"}
              </button>
            </div>
            <ul className="max-h-96 overflow-y-auto py-1">
              {live.alerts.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No activity yet</li>}
              {live.alerts.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/bookings/${a.bookingId}`} className="flex gap-3 px-4 py-2.5 hover:bg-muted">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", a.unread ? "bg-primary" : "bg-border")} />
                    <span className="min-w-0 text-sm">
                      <span className="block truncate font-medium">
                        {a.code} · {a.name}
                      </span>
                      <span className="block truncate text-muted-foreground">{a.message}</span>
                      <span className="text-xs text-muted-foreground">{formatRelative(a.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Account menu">
              <span className="grid size-7 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{initials(adminName)}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{adminName}</p>
              <p className="truncate text-xs text-muted-foreground">{adminEmail}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/security">
                <ShieldCheckIcon /> Security
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/settings">
                <UserRoundIcon /> Business profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={async () => {
                await api("/api/admin/auth/logout", { body: {} }).catch(() => undefined);
                router.replace("/admin/login");
                router.refresh();
              }}
            >
              <LogOutIcon /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

const MOBILE_NAV = [
  { href: "/admin", label: "Home", icon: LayoutDashboardIcon, exact: true },
  { href: "/admin/bookings", label: "Rides", icon: ClipboardListIcon, badge: "pending" as const },
  { href: "/admin/schedule", label: "Schedule", icon: CalendarDaysIcon },
  { href: "/admin/payments", label: "Payments", icon: WalletIcon, badge: "claims" as const },
];

/** Thumb-friendly bottom navigation for the driver on the road. */
export function AdminMobileNav() {
  const pathname = usePathname();
  const live = useLiveCounts();
  const { setOpenMobile } = useSidebar();
  return (
    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_-18px_rgb(10_10_10/0.2)] backdrop-blur-xl md:hidden">
      {MOBILE_NAV.map((n) => {
        const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
        const count = n.badge === "pending" ? live.pending : n.badge === "claims" ? live.paymentClaims : 0;
        return (
          <Link key={n.href} href={n.href} className={cn("relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
            <n.icon className="size-5" />
            {n.label}
            {count > 0 && <span className="absolute right-[22%] top-1.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{count}</span>}
          </Link>
        );
      })}
      <button type="button" onClick={() => setOpenMobile(true)} className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-muted-foreground">
        <MenuIcon className="size-5" /> More
      </button>
    </nav>
  );
}
