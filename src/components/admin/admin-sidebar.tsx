"use client";

import {
  BadgePercentIcon,
  CalendarDaysIcon,
  CarFrontIcon,
  ClipboardListIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  PlugZapIcon,
  SettingsIcon,
  ShieldCheckIcon,
  StarIcon,
  UsersIcon,
  WalletIcon,
  ExternalLinkIcon,
  MapPinnedIcon,
  MessageSquareQuoteIcon,
  PanelsTopLeftIcon,
  RouteIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useLiveCounts } from "./live-provider";

const GROUPS = [
  {
    label: "Operations",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon, exact: true },
      { href: "/admin/bookings", label: "Bookings", icon: ClipboardListIcon, badge: "pending" as const },
      { href: "/admin/schedule", label: "Schedule", icon: CalendarDaysIcon },
      { href: "/admin/payments", label: "Payments", icon: WalletIcon, badge: "claims" as const },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/admin/customers", label: "Customers", icon: UsersIcon },
      { href: "/admin/reviews", label: "Reviews", icon: StarIcon },
      { href: "/admin/promos", label: "Promotions", icon: BadgePercentIcon },
    ],
  },
  {
    label: "Website",
    items: [
      { href: "/admin/fleet", label: "Vehicles & fares", icon: CarFrontIcon },
      { href: "/admin/cities", label: "Cities", icon: MapPinnedIcon },
      { href: "/admin/routes", label: "Routes", icon: RouteIcon },
      { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquareQuoteIcon },
      { href: "/admin/website", label: "Home page & FAQ", icon: PanelsTopLeftIcon },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/admin/settings", label: "Settings", icon: SettingsIcon, exact: true },
      { href: "/admin/settings/integrations", label: "Integrations", icon: PlugZapIcon },
      { href: "/admin/security", label: "Security", icon: ShieldCheckIcon },
      { href: "/admin/audit", label: "Activity log", icon: HistoryIcon },
    ],
  },
];

export function AdminSidebar({ brand, adminName, accepting }: { brand: string; adminName: string; accepting: boolean }) {
  const pathname = usePathname();
  const live = useLiveCounts();
  const { setOpenMobile } = useSidebar();
  return (
    <Sidebar collapsible="icon" variant="inset" className="[--sidebar-width:16.5rem]">
      <SidebarHeader className="px-3 pt-4">
        <Link href="/admin" className="flex items-center gap-2 rounded-xl p-1.5 group-data-[collapsible=icon]:p-0">
          <Logo name={brand} tone="inverse" className="group-data-[collapsible=icon]:[&>span:last-child]:hidden [&>span:last-child]:text-[17px]" />
        </Link>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-sidebar-border bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/70 group-data-[collapsible=icon]:hidden">
          <span className="relative flex size-2">
            {accepting && <span className="absolute inline-flex size-full rounded-full bg-success opacity-70 animate-ping-slow" />}
            <span className={`relative inline-flex size-2 rounded-full ${accepting ? "bg-success" : "bg-primary"}`} />
          </span>
          {accepting ? "Accepting bookings" : "Bookings paused"}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-1 scrollbar-none">
        {GROUPS.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/35">{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {g.items.map((it) => {
                  const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`);
                  const count = it.badge === "pending" ? live.pending : it.badge === "claims" ? live.paymentClaims : 0;
                  return (
                    <SidebarMenuItem key={it.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={it.label}
                        className="relative h-10 rounded-xl px-3 text-[13.5px] font-medium text-sidebar-foreground transition-colors hover:bg-white/[0.05] hover:text-white data-active:bg-white/[0.08] data-active:font-semibold data-active:text-white [&_svg]:size-[18px] data-active:[&_svg]:text-primary"
                      >
                        <Link href={it.href} onClick={() => setOpenMobile(false)}>
                          {active && <span aria-hidden className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-primary group-data-[collapsible=icon]:hidden" />}
                          <it.icon />
                          <span>{it.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {count > 0 && <SidebarMenuBadge className="top-2.5 rounded-full bg-primary px-1.5 font-bold text-primary-foreground peer-hover/menu-button:text-primary-foreground peer-data-active/menu-button:text-primary-foreground">{count}</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="View website" className="h-10 rounded-xl px-3 text-[13.5px] text-sidebar-foreground hover:bg-white/[0.05] hover:text-white [&_svg]:size-[18px]">
              <a href="/" target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon />
                <span>View website</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.05] p-2.5 group-data-[collapsible=icon]:hidden">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">{adminName.trim().slice(0, 1).toUpperCase()}</span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-white">{adminName}</span>
            <span className="block text-[11px] text-white/45">Owner · Driver</span>
          </span>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
