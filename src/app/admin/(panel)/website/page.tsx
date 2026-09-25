import type { Metadata } from "next";
import { ContentForm } from "@/components/admin/settings-forms";
import { requireAdminPage } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Website content" };

export default async function AdminWebsitePage() {
  await requireAdminPage();
  const s = await getSettings();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">Website content</h1>
        <p className="text-sm text-muted-foreground">Home page hero, “Why choose us” and FAQs. Vehicles, cities, routes and testimonials have their own pages.</p>
      </div>
      <ContentForm initial={s.content} />
    </div>
  );
}
