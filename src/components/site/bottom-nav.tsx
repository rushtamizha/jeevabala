"use client";

import { cn } from "cn";
import { CarFrontIcon, HouseIcon, ReceiptTextIcon, RouteIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** App-style bottom navigation for phones: grey icons, the active tab orange with a bar that slides over it (CSS). */
export function SiteBottomNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "Home", icon: HouseIcon, match: (p: string) => p === "/" },
    { href: "/vehicles", label: "Fleet", icon: CarFrontIcon, match: (p: string) => p.startsWith("/vehicles") },
    { href: "/book", label: "Book", icon: RouteIcon, match: (p: string) => p.startsWith("/book") },
    { href: signedIn ? "/account/bookings" : "/login?next=%2Faccount%2Fbookings", label: "Rides", icon: ReceiptTextIcon, match: (p: string) => p.startsWith("/account/bookings") },
    { href: signedIn ? "/account" : "/login", label: signedIn ? "Account" : "Sign in", icon: UserRoundIcon, match: (p: string) => p === "/account" || p.startsWith("/account/profile") || p === "/login" },
  ];
  const active = items.findIndex((it) => it.match(pathname));
  return (
    <nav aria-label="App navigation" className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_-18px_rgb(10_10_10/0.2)] backdrop-blur-xl md:hidden">
      <ul className="relative grid grid-cols-5">
        <span
          aria-hidden
          className="absolute top-0 left-0 flex w-1/5 justify-center transition-[transform,translate,scale,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(${Math.max(active, 0) * 100}%)`, opacity: active < 0 ? 0 : 1 }}
        >
          <span className="h-[3px] w-8 rounded-b-full bg-primary" />
        </span>
        {items.map((it, i) => (
          <li key={it.label}>
            <Link href={it.href} aria-current={i === active ? "page" : undefined} className={cn("flex flex-col items-center gap-1 pb-2.5 pt-3 text-[11px] font-medium transition-colors", i === active ? "text-primary" : "text-muted-foreground")}>
              <it.icon className={cn("size-[22px]", i === active && "fill-primary/15")} strokeWidth={i === active ? 2.2 : 1.8} />
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
