"use client";

import { cn } from "cn";
import {
  ArrowRightIcon,
  CarFrontIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  IndianRupeeIcon,
  MapPinIcon,
  MenuIcon,
  PhoneIcon,
  PlaneIcon,
  RepeatIcon,
  RouteIcon,
  SparklesIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { cityRegion, HILL_STATIONS, REGION_LABEL, type CityRegion } from "@/lib/city-meta";
import { firstName, formatRate } from "@/lib/format";

export type NavData = {
  vehicles: { name: string; slug: string | null; id: string; seats: number; fromPerKm: number; category: string }[];
  cities: { name: string; slug: string; state: string; district: string | null; featured: boolean }[];
  routes: { slug: string; fromName: string; toName: string; distanceKm: number }[];
};

type Leaf = { label: string; href: string; caption?: string };
type Group = Leaf & { icon?: React.ReactNode; children?: Leaf[] };
type TopItem = { label: string; href: string; icon: React.ReactNode; items?: Group[]; footer?: Leaf };

function buildMenu(nav: NavData): TopItem[] {
  const featured = nav.cities.filter((c) => c.featured);
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const city = (c: NavData["cities"][number]): Leaf => ({ label: c.name, href: `/${c.slug}-taxi` });
  const region = (r: CityRegion) => nav.cities.filter((c) => cityRegion(c) === r).sort(byName);
  const hills = nav.cities.filter((c) => HILL_STATIONS.has(c.slug)).sort(byName);
  const regionGroup = (r: CityRegion, anchor: string): Group[] => {
    const list = region(r);
    return list.length ? [{ label: REGION_LABEL[r], href: `/cities#${anchor}`, caption: `${list.length} cities & towns`, icon: <MapPinIcon className="size-4" />, children: list.map(city) }] : [];
  };

  const byOrigin = new Map<string, NavData["routes"]>();
  for (const r of nav.routes) byOrigin.set(r.fromName, [...(byOrigin.get(r.fromName) ?? []), r]);
  const originCity = (name: string) => nav.cities.find((c) => c.name === name);

  const items: TopItem[] = [
    {
      label: "Services",
      href: "/book",
      icon: <SparklesIcon className="size-4" />,
      items: [
        { label: "One-way drop", href: "/book?trip=ONE_WAY", caption: "Pay only one way, to any city", icon: <RouteIcon className="size-4" /> },
        { label: "Round trip", href: "/book?trip=ROUND_TRIP", caption: "Multi-day tours, same driver", icon: <RepeatIcon className="size-4" /> },
        { label: "Airport transfer", href: "/book?trip=AIRPORT", caption: "On-time, flight-aware pickups", icon: <PlaneIcon className="size-4" /> },
        { label: "Local hourly", href: "/book?trip=LOCAL", caption: "4, 8 & 12 hour city packages", icon: <ClockIcon className="size-4" /> },
      ],
    },
    {
      label: "Fleet",
      href: "/vehicles",
      icon: <CarFrontIcon className="size-4" />,
      items: nav.vehicles.map((v) => ({ label: v.name, href: `/vehicles#${v.slug ?? v.id}`, caption: `${v.seats} seats · from ${formatRate(v.fromPerKm)}/km`, icon: <CarFrontIcon className="size-4" /> })),
      footer: { label: "Compare all vehicles & fares", href: "/vehicles" },
    },
    {
      label: "Cities",
      href: "/cities",
      icon: <MapPinIcon className="size-4" />,
      items: [
        ...(featured.length ? [{ label: "Popular cities", href: "/cities#popular", caption: `${featured.length} most-booked`, icon: <SparklesIcon className="size-4" />, children: featured.map(city) }] : []),
        ...regionGroup("north", "north"),
        ...regionGroup("west", "west"),
        ...regionGroup("central", "central"),
        ...regionGroup("south", "south"),
        ...(hills.length ? [{ label: "Hill stations", href: "/cities#hill-stations", caption: hills.map((c) => c.name).slice(0, 3).join(", "), icon: <RouteIcon className="size-4" />, children: hills.map(city) }] : []),
        ...(region("other").length ? [{ label: REGION_LABEL.other, href: "/cities#other", caption: region("other").map((c) => c.name).slice(0, 3).join(", "), icon: <RouteIcon className="size-4" />, children: region("other").map(city) }] : []),
      ],
      footer: { label: `All ${nav.cities.length} cities we serve`, href: "/cities" },
    },
    {
      label: "Routes",
      href: "/routes",
      icon: <RouteIcon className="size-4" />,
      items: [...byOrigin.entries()].slice(0, 7).map(([from, list]) => ({
        label: `From ${from}`,
        href: originCity(from) ? `/${originCity(from)!.slug}-taxi` : "/routes",
        caption: `${list.length} popular route${list.length === 1 ? "" : "s"}`,
        icon: <MapPinIcon className="size-4" />,
        children: list.map((r) => ({ label: `${r.fromName} → ${r.toName}`, href: `/${r.slug}-taxi`, caption: `${r.distanceKm} km` })),
      })),
      footer: { label: "All routes & fares", href: "/routes" },
    },
    { label: "Fares", href: "/vehicles#fares", icon: <IndianRupeeIcon className="size-4" /> },
  ];
  return items.filter((m) => !m.items || m.items.length > 0);
}

const WIDE_SUB = 10;
const PANEL = "rounded-2xl border bg-white p-2 shadow-float animate-in fade-in-0 slide-in-from-top-1 zoom-in-[0.98] duration-200";

export function SiteHeader({ brand, slogan, customerName, phone, nav }: { brand: string; slogan: string; customerName: string | null; phone?: string; nav: NavData }) {
  const menu = buildMenu(nav);
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [activeSub, setActiveSub] = useState<number | null>(null);
  const [subSide, setSubSide] = useState<"right" | "left">("right");
  const [pill, setPill] = useState({ left: 0, width: 0, on: false });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState<number | null>(null);
  const [mobileSub, setMobileSub] = useState<number | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Touch screens have no hover: the first tap on a parent item opens its menu, the second follows the link.
  const pointer = useRef<string>("mouse");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const [brandFirst, ...brandRest] = brand.split(" ");
  const loginHref = `/login${pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : ""}`;
  const isActive = (href: string) => {
    if (href.includes("#")) return false; // in-page anchors (e.g. Fares) never claim the active state
    const path = href.split(/[?#]/)[0];
    return path !== "/" && (pathname === path || pathname.startsWith(`${path}/`));
  };

  const openMenu = (i: number, el: HTMLElement) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (activeMenu !== i) setActiveSub(null); // keep an open sub-menu while focus moves inside it
    setActiveMenu(i);
    setPill({ left: el.offsetLeft, width: el.offsetWidth, on: true });
  };
  const closeMenu = (delay = 140) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setActiveMenu(null);
      setActiveSub(null);
      setPill((p) => ({ ...p, on: false }));
    }, delay);
  };
  const openSub = (j: number, row: HTMLElement, wide: boolean) => {
    // Flip the second-level panel to the left when it would run off-screen.
    const r = row.getBoundingClientRect();
    setSubSide(r.right + (wide ? 560 : 300) + 16 > window.innerWidth ? "left" : "right");
    setActiveSub(j);
  };
  const done = () => {
    setActiveMenu(null);
    setActiveSub(null);
    setMobileOpen(false);
    setPill((p) => ({ ...p, on: false }));
  };

  return (
    <nav aria-label="Main" className="no-print pointer-events-none sticky top-0 z-50 h-[76px] w-full px-3 pt-3 sm:px-4">
      {mobileOpen && (
        <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="pointer-events-auto fixed inset-0 cursor-default bg-black/30 backdrop-blur-[2px] animate-in fade-in-0 duration-200 lg:hidden" />
      )}
      <div
        className={cn(
          "pointer-events-auto relative mx-auto flex h-[60px] w-full max-w-7xl items-center justify-between rounded-full border bg-white/95 py-2 pl-2 pr-2 backdrop-blur-xl transition-shadow duration-500 sm:pl-2.5",
          scrolled ? "shadow-[0_12px_40px_-12px_rgb(10_10_10/0.18)]" : "shadow-[0_2px_10px_-4px_rgb(10_10_10/0.08)]",
        )}
      >
        {/* Brand */}
        <Link href="/" onClick={done} aria-label={`${brand} home`} className="group flex shrink-0 items-center gap-2.5 pr-3">
          <LogoMark className="size-10 rounded-full transition-transform duration-300 group-hover:rotate-[-8deg]" />
          <span className="flex flex-col justify-center leading-tight">
            <span className="text-[15px] font-bold tracking-tight">
              <span className="text-primary">{brandFirst}</span>
              {brandRest.length > 0 && <span className="ml-1 text-foreground">{brandRest.join(" ")}</span>}
            </span>
            <span className="max-w-44 truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{slogan}</span>
          </span>
        </Link>

        {/* Desktop menu — React Bits "PillNav": one pill glides to the hovered item */}
        <ul className="relative hidden items-center lg:flex" onMouseLeave={() => closeMenu()}>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-secondary transition-[transform,translate,scale,width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translateX(${pill.left}px)`, width: pill.width, opacity: pill.on ? 1 : 0 }}
          />
          {menu.map((m, i) => {
            const open = activeMenu === i && Boolean(m.items);
            const mega = Boolean(m.items?.some((g) => g.children));
            return (
              <li
                key={m.label}
                className={mega ? undefined : "relative"}
                onPointerDown={(e) => (pointer.current = e.pointerType)}
                onMouseEnter={(e) => openMenu(i, e.currentTarget)}
                onFocus={(e) => openMenu(i, e.currentTarget)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) closeMenu(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    closeMenu(0);
                    (e.currentTarget.querySelector("a") as HTMLAnchorElement | null)?.focus();
                  }
                }}
              >
                <Link
                  href={m.href}
                  onClick={(e) => {
                    if (m.items && !open && pointer.current !== "mouse") {
                      e.preventDefault();
                      openMenu(i, e.currentTarget.parentElement as HTMLElement);
                      return;
                    }
                    done();
                  }}
                  aria-haspopup={m.items ? "true" : undefined}
                  aria-expanded={m.items ? open : undefined}
                  className={cn(
                    "relative flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold transition-colors",
                    open || isActive(m.href) ? "text-primary" : "text-foreground/80 hover:text-foreground",
                  )}
                >
                  {m.label}
                  {m.items && <ChevronDownIcon aria-hidden className={cn("size-3.5 shrink-0 opacity-60 transition-transform duration-300", open && "rotate-180 opacity-100")} />}
                </Link>

                {/* Mega menu (groups with sub-lists): groups on the left, the active group's links on the right — centred under the bar so it never runs off-screen */}
                {open && m.items && mega && (() => {
                  const g = m.items[activeSub ?? 0] ?? m.items[0];
                  return (
                    <div className="absolute inset-x-0 top-full z-10 flex justify-center pt-3">
                      <div className={cn(PANEL, "grid w-[min(880px,calc(100vw-2rem))] shrink-0 grid-cols-[250px_minmax(0,1fr)] gap-2")}>
                        <div className="flex flex-col gap-0.5">
                          {m.items.map((grp, j) => {
                            const on = (activeSub ?? 0) === j;
                            return (
                              <Link
                                key={grp.label}
                                href={grp.href}
                                onMouseEnter={() => setActiveSub(j)}
                                onFocus={() => setActiveSub(j)}
                                onClick={(e) => {
                                  if (!on && pointer.current !== "mouse") {
                                    e.preventDefault();
                                    setActiveSub(j);
                                    return;
                                  }
                                  done();
                                }}
                                className={cn("group/row flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors", on ? "bg-accent" : "hover:bg-secondary")}
                              >
                                <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl transition-colors", on ? "bg-primary text-white" : "bg-secondary text-primary group-hover/row:bg-white")}>{grp.icon}</span>
                                <span className="min-w-0 flex-1">
                                  <span className={cn("block truncate text-[13px] font-semibold", on && "text-primary")}>{grp.label}</span>
                                  {grp.caption && <span className="block truncate text-[11.5px] text-muted-foreground">{grp.caption}</span>}
                                </span>
                                <ChevronRightIcon aria-hidden className={cn("size-3.5 shrink-0 transition-transform", on ? "translate-x-0.5 text-primary" : "text-muted-foreground")} />
                              </Link>
                            );
                          })}
                          {m.footer && (
                            <Link href={m.footer.href} onClick={done} className="mt-auto flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5 text-[13px] font-semibold transition-colors hover:bg-accent hover:text-primary">
                              {m.footer.label} <ArrowRightIcon className="size-3.5 text-primary" />
                            </Link>
                          )}
                        </div>
                        <div key={g.label} className="flex min-h-[20rem] flex-col rounded-xl bg-secondary/60 p-3 animate-in fade-in-0 duration-200">
                          <div className="flex items-center justify-between gap-3 px-1 pb-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                              {g.label} <span className="normal-case tracking-normal">· {g.children?.length ?? 0}</span>
                            </p>
                            <Link href={g.href} onClick={done} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                              View all <ArrowRightIcon className="size-3" />
                            </Link>
                          </div>
                          <div className="grid max-h-[min(58vh,26rem)] grid-cols-2 content-start gap-0.5 overflow-y-auto overscroll-contain xl:grid-cols-3">
                            {(g.children ?? []).map((c) => (
                              <Link key={c.href} href={c.href} onClick={done} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-foreground/85 transition-colors hover:bg-white hover:text-primary">
                                <span className="truncate">{c.label}</span>
                                {c.caption && <span className="shrink-0 text-[11px] text-muted-foreground">{c.caption}</span>}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Level 1 */}
                {open && m.items && !mega && (
                  <div className="absolute left-1/2 top-full z-10 -translate-x-1/2 pt-3">
                    <div className={cn(PANEL, m.label === "Fleet" ? "w-80" : "w-72")}>
                      {m.items.map((g, j) => {
                        const wide = (g.children?.length ?? 0) >= WIDE_SUB;
                        return (
                          <div
                            key={g.label}
                            className="relative"
                            onMouseEnter={(e) => (g.children ? openSub(j, e.currentTarget, wide) : setActiveSub(null))}
                            onFocus={(e) => g.children && e.target === e.currentTarget.firstElementChild && openSub(j, e.currentTarget, wide)}
                          >
                            <Link
                              href={g.href}
                              onClick={(e) => {
                                if (g.children && activeSub !== j && pointer.current !== "mouse") {
                                  e.preventDefault();
                                  openSub(j, e.currentTarget.parentElement as HTMLElement, wide);
                                  return;
                                }
                                done();
                              }}
                              aria-haspopup={g.children ? "true" : undefined}
                              aria-expanded={g.children ? activeSub === j : undefined}
                              className={cn(
                                "group/row flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                                activeSub === j ? "bg-accent" : "hover:bg-secondary",
                              )}
                            >
                              {g.icon && (
                                <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl transition-colors", activeSub === j ? "bg-primary text-white" : "bg-secondary text-primary group-hover/row:bg-white")}>
                                  {g.icon}
                                </span>
                              )}
                              <span className="min-w-0 flex-1">
                                <span className={cn("block truncate text-[13px] font-semibold", activeSub === j && "text-primary")}>{g.label}</span>
                                {g.caption && <span className="block truncate text-[11.5px] text-muted-foreground">{g.caption}</span>}
                              </span>
                              {g.children && <ChevronRightIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />}
                            </Link>

                            {/* Level 2 */}
                            {g.children && activeSub === j && (
                              <div className={cn("absolute z-20", subSide === "right" ? "left-full pl-2.5" : "right-full pr-2.5", wide ? "-top-10" : "-top-2")}>
                                <div className={cn(PANEL, "grid max-h-[70vh] gap-0.5 overflow-y-auto", wide ? "w-[540px] grid-cols-3" : "w-72 grid-cols-1")}>
                                  {g.children.map((c) => (
                                    <Link key={c.href} href={c.href} onClick={done} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-foreground/85 transition-colors hover:bg-secondary hover:text-primary">
                                      <span className="truncate">{c.label}</span>
                                      {c.caption && <span className="shrink-0 text-[11px] text-muted-foreground">{c.caption}</span>}
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {m.footer && (
                        <Link href={m.footer.href} onClick={done} className="mt-1.5 flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent hover:text-primary">
                          {m.footer.label} <ArrowRightIcon className="size-3.5 text-primary" />
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {phone && (
            <a href={`tel:${phone}`} aria-label={`Call ${phone}`} className="hidden size-10 place-items-center rounded-full bg-secondary text-primary transition-colors hover:bg-accent sm:grid lg:hidden xl:grid">
              <PhoneIcon className="size-4" />
            </a>
          )}
          {customerName ? (
            <Link href="/account" onClick={done} className="hidden h-10 items-center gap-2 rounded-full bg-secondary pl-1.5 pr-4 text-[13px] font-semibold transition-colors hover:bg-accent sm:inline-flex">
              <span className="grid size-7 place-items-center rounded-full bg-foreground text-[11px] font-bold text-white">{firstName(customerName).slice(0, 1).toUpperCase()}</span>
              {firstName(customerName)}
            </Link>
          ) : (
            <Link href={loginHref} onClick={done} className="hidden h-10 items-center rounded-full px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:text-primary sm:inline-flex">
              Sign in
            </Link>
          )}
          <Link href="/book" onClick={done} className="sheen hidden h-10 items-center gap-1.5 rounded-full bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-glow transition-colors hover:bg-(--primary-hover) sm:inline-flex">
            Book a ride <ArrowRightIcon className="size-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            className="grid size-10 place-items-center rounded-full bg-foreground text-white transition-transform active:scale-95 lg:hidden"
          >
            {mobileOpen ? <XIcon className="size-[18px]" /> : <MenuIcon className="size-[18px]" />}
          </button>
        </div>

        {/* Mobile sheet */}
        {mobileOpen && (
          <>
            <div
              id="mobile-menu"
              className="absolute inset-x-0 top-[calc(100%+10px)] max-h-[calc(100svh-104px)] overflow-y-auto overscroll-contain rounded-3xl border bg-white p-3 shadow-float animate-in fade-in-0 slide-in-from-top-2 duration-300 lg:hidden"
            >
              <ul className="divide-y">
                {menu.map((m, i) => {
                  const open = mobileMenu === i;
                  return (
                    <li key={m.label} className="py-1 first:pt-0 last:pb-0">
                      <div className="flex items-center">
                        <Link href={m.href} onClick={done} className={cn("flex flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-[15px] font-semibold", isActive(m.href) && "text-primary")}>
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">{m.icon}</span>
                          {m.label}
                        </Link>
                        {m.items && (
                          <button
                            type="button"
                            onClick={() => {
                              setMobileMenu(open ? null : i);
                              setMobileSub(null);
                            }}
                            aria-label={`${open ? "Collapse" : "Expand"} ${m.label}`}
                            aria-expanded={open}
                            className={cn("grid size-9 shrink-0 place-items-center rounded-full transition-colors", open ? "bg-primary text-white" : "bg-secondary text-foreground")}
                          >
                            <ChevronDownIcon className={cn("size-4 transition-transform duration-300", open && "rotate-180")} />
                          </button>
                        )}
                      </div>
                      {m.items && (
                        <div className={cn("grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                          <div className="overflow-hidden">
                            <ul className="mb-2 ml-[1.35rem] mt-1 space-y-0.5 border-l pl-4">
                              {m.items.map((g, j) => (
                                <li key={g.label}>
                                  <div className="flex items-center">
                                    <Link href={g.href} onClick={done} className="min-w-0 flex-1 rounded-lg py-2 pr-2 text-sm font-semibold">
                                      <span className="block truncate">{g.label}</span>
                                      {g.caption && <span className="block truncate text-xs font-normal text-muted-foreground">{g.caption}</span>}
                                    </Link>
                                    {g.children && (
                                      <button
                                        type="button"
                                        onClick={() => setMobileSub(mobileSub === j ? null : j)}
                                        aria-label={`${mobileSub === j ? "Collapse" : "Expand"} ${g.label}`}
                                        aria-expanded={mobileSub === j}
                                        className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground"
                                      >
                                        <ChevronDownIcon className={cn("size-3.5 transition-transform duration-300", mobileSub === j && "rotate-180")} />
                                      </button>
                                    )}
                                  </div>
                                  {g.children && (
                                    <div className={cn("grid transition-[grid-template-rows] duration-300", mobileSub === j ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                                      <div className="overflow-hidden">
                                        <div className={cn("gap-1 pb-2", g.children.length >= WIDE_SUB ? "grid grid-cols-2" : "grid")}>
                                          {g.children.map((c) => (
                                            <Link key={c.href} href={c.href} onClick={done} className="truncate rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-foreground/80 transition-colors hover:text-primary">
                                              {c.label}
                                            </Link>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 grid gap-2 border-t pt-3">
                <Link href="/book" onClick={done} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-glow active:scale-[0.98]">
                  Book a ride <ArrowRightIcon className="size-4" />
                </Link>
                <div className="grid grid-cols-2 gap-2">
                  <Link href={customerName ? "/account" : loginHref} onClick={done} className="flex h-12 items-center justify-center gap-2 rounded-full bg-secondary text-sm font-semibold">
                    <UserRoundIcon className="size-4" /> {customerName ? "My account" : "Sign in"}
                  </Link>
                  {phone ? (
                    <a href={`tel:${phone}`} className="flex h-12 items-center justify-center gap-2 rounded-full bg-secondary text-sm font-semibold">
                      <PhoneIcon className="size-4 text-primary" /> Call now
                    </a>
                  ) : (
                    <Link href="/#faq" onClick={done} className="flex h-12 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                      FAQ
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
