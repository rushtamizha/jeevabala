import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { PrivacyControls, ProfileForm, SavedPlaces } from "@/components/account/profile-forms";
import { db } from "@/db";
import { savedPlaces } from "@/db/schema";
import { requireCustomerPage } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { customer } = await requireCustomerPage("/account/profile");
  const places = await db.select().from(savedPlaces).where(eq(savedPlaces.customerId, customer.id));
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-5 font-semibold">Personal details</h2>
        <ProfileForm
          initial={{
            name: customer.name,
            email: customer.email,
            phone: customer.phone ?? "",
            marketingOptIn: customer.marketingOptIn,
            whatsappOptIn: customer.whatsappOptIn,
          }}
        />
      </section>
      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-1 font-semibold">Saved places</h2>
        <p className="mb-4 text-sm text-muted-foreground">Appear instantly when you tap the pickup or drop field.</p>
        <SavedPlaces places={places.map((p) => ({ id: p.id, label: p.label, address: p.address }))} />
      </section>
      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-1 font-semibold">Privacy</h2>
        <p className="mb-4 text-sm text-muted-foreground">You own your data. Export it anytime, or erase your account.</p>
        <PrivacyControls />
      </section>
    </div>
  );
}
