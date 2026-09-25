"use client";

import { EyeIcon, EyeOffIcon, ReplyIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";
import { TextInput } from "./form-kit";

export function ReviewRow({ r }: { r: { id: string; rating: number; comment: string | null; isPublished: boolean; adminReply: string | null; name: string; code: string; bookingId: string; date: string } }) {
  const router = useRouter();
  const [reply, setReply] = useState(r.adminReply ?? "");
  const [showReply, setShowReply] = useState(false);
  const patch = async (body: Record<string, unknown>, ok: string) => {
    try {
      await api(`/api/admin/reviews/${r.id}`, { method: "PATCH", body });
      toast.success(ok);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <li className="space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <StarIcon key={i} className={i <= r.rating ? "size-4 fill-gold text-gold" : "size-4 text-muted-foreground/30"} />
            ))}
          </div>
          <p className="mt-1 text-sm font-medium">
            {r.name} · <Link href={`/admin/bookings/${r.bookingId}`} className="font-mono text-primary">{r.code}</Link>
            <span className="ml-2 text-xs font-normal text-muted-foreground">{r.date}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowReply((v) => !v)}><ReplyIcon /> Reply</Button>
          {r.isPublished ? (
            <Button size="sm" variant="secondary" onClick={() => patch({ isPublished: false }, "Hidden from website")}><EyeOffIcon /> Unpublish</Button>
          ) : (
            <Button size="sm" onClick={() => patch({ isPublished: true }, "Published on website")} disabled={!r.comment}><EyeIcon /> Publish</Button>
          )}
        </div>
      </div>
      {r.comment ? <p className="text-sm text-muted-foreground">“{r.comment}”</p> : <p className="text-sm text-muted-foreground">Rating only (can’t be published without a comment)</p>}
      {r.adminReply && !showReply && <p className="rounded-xl bg-secondary p-3 text-sm">↳ {r.adminReply}</p>}
      {showReply && (
        <div className="flex gap-2">
          <TextInput value={reply} onChange={setReply} maxLength={400} placeholder="Thank you for riding with us!" />
          <Button onClick={async () => { await patch({ adminReply: reply }, "Reply saved"); setShowReply(false); }}>Save</Button>
        </div>
      )}
    </li>
  );
}
