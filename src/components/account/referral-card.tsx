"use client";

import { GiftIcon, Share2Icon } from "lucide-react";
import { CopyButton } from "@/components/shared/copy-button";
import { WhatsAppIcon } from "@/components/shared/icons";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";

export function ReferralCard({ code, link, refereeDiscount, referrerBonus, brand, friends }: { code: string; link: string; refereeDiscount: number; referrerBonus: number; brand: string; friends: number }) {
  const message = `I ride with ${brand} — a trusted personal driver with honest fares. Use my code ${code} to get ${formatINR(refereeDiscount)} off your first ride: ${link}`;
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-6">
      <div aria-hidden className="absolute -right-16 -top-16 size-48 rounded-full bg-[radial-gradient(circle,rgb(251_91_33/0.16),transparent_65%)]" />
      <div className="relative">
        <div className="flex items-center gap-2.5 font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-primary"><GiftIcon className="size-4" /></span> Invite friends, earn credits
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Friends get <span className="font-medium text-foreground">{formatINR(refereeDiscount)} off</span> their first ride. You get{" "}
          <span className="font-medium text-foreground">{formatINR(referrerBonus)}</span> in credits when they complete it.
        </p>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-primary/40 bg-accent/60 px-4 py-3">
          <span className="font-mono text-lg font-semibold tracking-[0.2em]">{code}</span>
          <CopyButton value={link} label="Copy link" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon className="size-4" /> Share on WhatsApp
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (navigator.share) void navigator.share({ title: brand, text: message, url: link }).catch(() => undefined);
              else void navigator.clipboard.writeText(message);
            }}
          >
            <Share2Icon /> Share
          </Button>
        </div>
        {friends > 0 && <p className="mt-3 text-xs text-muted-foreground">{friends} friend{friends > 1 ? "s" : ""} joined with your code</p>}
      </div>
    </div>
  );
}
