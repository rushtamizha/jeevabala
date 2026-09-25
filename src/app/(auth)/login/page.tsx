import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GiftIcon, ReceiptTextIcon, ShieldCheckIcon } from "lucide-react";
import { AuthForm } from "@/components/account/login-form";
import { AuthShell } from "@/components/account/auth-shell";
import { getCustomerSession, safeNextPath } from "@/lib/server/auth";
import { env } from "@/lib/server/env";
import { getSetting } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Sign in or create an account", robots: { index: false } };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : undefined);
  if (await getCustomerSession()) redirect(next);
  const e = env();
  const business = await getSetting("business");
  return (
    <AuthShell
      brand={business.name}
      eyebrow="Rider account"
      title="Every ride,"
      highlight="one tap away."
      points={[
        { icon: <ReceiptTextIcon className="size-5" />, title: "Track every trip", text: "Live status, Ride PIN and receipts in one place." },
        { icon: <GiftIcon className="size-5" />, title: "Earn as you ride", text: "Tier discounts and referral credits, applied automatically." },
        { icon: <ShieldCheckIcon className="size-5" />, title: "No passwords", text: "A one-time code to your email is all it takes." },
      ]}
      footnote={<>© {new Date().getFullYear()} {business.name} · Secure, password-free sign in</>}
    >
      <AuthForm next={next} initialMode={sp.mode === "register" ? "register" : "signin"} turnstileSiteKey={e.TURNSTILE_SECRET_KEY ? e.TURNSTILE_SITE_KEY : undefined} />
    </AuthShell>
  );
}
