import type { Metadata } from "next";
import { PromoManager } from "@/components/admin/promo-manager";
import { listPromosAdmin } from "@/lib/server/admin-data";
import { requireAdminPage } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Promotions" };

export default async function PromosPage() {
  await requireAdminPage();
  const rows = await listPromosAdmin();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">Promotions</h1>
        <p className="text-sm text-muted-foreground">Promo codes are validated server-side, locked during booking and can’t be stacked. Share links like <code>/?promo=CODE</code>.</p>
      </div>
      <PromoManager
        promos={rows.map((p) => ({
          id: p.id,
          code: p.code,
          description: p.description,
          discountType: p.discountType,
          value: p.value,
          maxDiscount: p.maxDiscount,
          minFare: p.minFare,
          usageLimit: p.usageLimit,
          perCustomerLimit: p.perCustomerLimit,
          firstRideOnly: p.firstRideOnly,
          startsAt: p.startsAt?.toISOString() ?? null,
          expiresAt: p.expiresAt?.toISOString() ?? null,
          isActive: p.isActive,
          used: p.used,
        }))}
      />
    </div>
  );
}
