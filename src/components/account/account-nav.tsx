"use client";

import { cn } from "cn";
import { ArrowRightIcon, HeadsetIcon, LayoutDashboardIcon, LogOutIcon, PhoneIcon, ReceiptTextIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { WhatsAppIcon } from "@/components/shared/icons";
import { api } from "@/lib/api-client";
import { initials, phoneDigits } from "@/lib/format";

const TABS = [
  { href: "/account", label: "Overview", icon: LayoutDashboardIcon, exact: true },
  { href: "/account/bookings", label: "My rides", icon: ReceiptTextIcon },
  { href: "/account/profile", label: "Profile & places", icon: UserRoundIcon },
];

function useSignOut() {
  const router = useRouter();
  return async () => {
    await api("/api/auth/logout", { body: {} }).catch(() => undefined);
    toast.success("Signed out");
    router.replace("/");
    router.refresh();
  };
}

/** Dashboard navigation: sticky sidebar card on desktop, pill tabs on phones. */
export function AccountNav({ name, email, phone, whatsapp }: { name: string; email: string; phone?: string; whatsapp?: string }) {
  const pathname = usePathname();
  const signOut = useSignOut();
  const isActive = (t: (typeof TABS)[number]) => (t.exact ? pathname === t.href : pathname.startsWith(t.href));

  return (
    <>
      {/* Phones & tablets */}
      <div className="flex items-center gap-2 lg:hidden">
        <nav aria-label="Account" className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-full bg-secondary p-1 scrollbar-none">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={isActive(t) ? "page" : undefined}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors",
                isActive(t) ? "bg-card text-foreground shadow-[0_1px_3px_rgb(10_10_10/0.1)]" : "text-muted-foreground",
              )}
            >
              <t.icon className={cn("size-4", isActive(t) && "text-primary")} /> {t.label}
            </Link>
          ))}
        </nav>
        <button type="button" onClick={signOut} aria-label="Sign out" className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-destructive">
          <LogOutIcon className="size-4" />
        </button>
      </div>

      {/* Desktop */}
      <aside className="sticky top-24 hidden space-y-3 self-start lg:block">
        <div className="rounded-2xl border bg-card p-2">
          <div className="flex items-center gap-3 rounded-xl bg-secondary p-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-sm font-bold text-white">{initials(name)}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{name}</span>
              <span className="block truncate text-xs text-muted-foreground">{email}</span>
            </span>
          </div>
          <nav aria-label="Account" className="mt-2 space-y-0.5">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                aria-current={isActive(t) ? "page" : undefined}
                className={cn(
                  "group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                  isActive(t) ? "bg-accent text-primary" : "text-foreground/75 hover:bg-secondary hover:text-foreground",
                )}
              >
                {isActive(t) && <span aria-hidden className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-primary" />}
                <t.icon className="size-[18px]" /> {t.label}
              </Link>
            ))}
            <button type="button" onClick={signOut} className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-foreground/75 transition-colors hover:bg-destructive/6 hover:text-destructive">
              <LogOutIcon className="size-[18px]" /> Sign out
            </button>
          </nav>
          <Link href="/book" className="sheen mt-2 flex h-11 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-white shadow-glow transition-colors hover:bg-(--primary-hover)">
            Book a ride <ArrowRightIcon className="size-4" />
          </Link>
        </div>

        {(phone || whatsapp) && (
          <div className="rounded-2xl border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-bold">
              <HeadsetIcon className="size-4 text-primary" /> Need a hand?
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Talk to a real person, any time of day.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {phone && (
                <a href={`tel:${phone}`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-secondary text-xs font-semibold transition-colors hover:bg-accent hover:text-primary">
                  <PhoneIcon className="size-3.5" /> Call
                </a>
              )}
              {whatsapp && (
                <a href={`https://wa.me/${phoneDigits(whatsapp)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-secondary text-xs font-semibold transition-colors hover:bg-[#25D366]/10 hover:text-[#1a9e4b]">
                  <WhatsAppIcon className="size-3.5" /> WhatsApp
                </a>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
