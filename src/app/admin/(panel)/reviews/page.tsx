import type { Metadata } from "next";
import { StarIcon } from "lucide-react";
import { ReviewRow } from "@/components/admin/review-row";
import { listReviewsAdmin } from "@/lib/server/admin-data";
import { requireAdminPage } from "@/lib/server/auth";
import { getSetting } from "@/lib/server/settings";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  await requireAdminPage();
  const [rows, business] = await Promise.all([listReviewsAdmin(), getSetting("business")]);
  const avg = rows.length ? rows.reduce((s, r) => s + r.review.rating, 0) / rows.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: rows.filter((r) => r.review.rating === n).length }));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.75rem]">Reviews</h1>
        <p className="text-sm text-muted-foreground">Publish your best reviews on the homepage. Only verified trips can be reviewed.</p>
      </div>
      <section className="grid gap-6 rounded-2xl border bg-card p-6 sm:grid-cols-[180px_1fr] sm:items-center">
        <div className="text-center">
          <p className="text-5xl font-semibold tabular">{avg ? avg.toFixed(1) : "—"}</p>
          <div className="mt-2 flex justify-center gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <StarIcon key={i} className={i <= Math.round(avg) ? "size-5 fill-gold text-gold" : "size-5 text-muted-foreground/30"} />
            ))}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">({rows.length} reviews)</p>
        </div>
        <ul className="space-y-2">
          {dist.map((d) => (
            <li key={d.n} className="flex items-center gap-3 text-sm">
              <span className="w-3 tabular">{d.n}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${rows.length ? (d.c / rows.length) * 100 : 0}%` }} />
              </span>
              <span className="w-6 text-right text-muted-foreground tabular">{d.c}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {rows.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">No reviews yet — customers can rate trips after completion.</p>}
        <ul className="divide-y">
          {rows.map((r) => (
            <ReviewRow
              key={r.review.id}
              r={{
                id: r.review.id,
                rating: r.review.rating,
                comment: r.review.comment,
                isPublished: r.review.isPublished,
                adminReply: r.review.adminReply,
                name: r.name,
                code: r.code,
                bookingId: r.bookingId,
                date: formatDateTime(r.review.createdAt, business.timezone, "date"),
              }}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
