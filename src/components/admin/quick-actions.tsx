"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api, errorMessage } from "@/lib/api-client";

const REASONS = ["Driver unavailable at this time", "Outside our service area", "Vehicle under maintenance", "Duplicate booking"];

export function AcceptRejectButtons({ bookingId, compact }: { bookingId: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);

  const act = async (body: Record<string, unknown>, kind: "accept" | "reject") => {
    setBusy(kind);
    try {
      await api(`/api/admin/bookings/${bookingId}/action`, { body });
      toast.success(kind === "accept" ? "Ride accepted — customer notified" : "Request declined — customer notified");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button size={compact ? "sm" : "default"} variant="outline" onClick={() => setOpen(true)} disabled={busy !== null} aria-label="Decline">
          <XIcon /> {!compact && "Decline"}
        </Button>
        <Button size={compact ? "sm" : "default"} onClick={() => act({ action: "accept" }, "accept")} disabled={busy !== null}>
          {busy === "accept" ? <Spinner /> : <CheckIcon />} Accept
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline this ride?</DialogTitle>
            <DialogDescription>The customer is notified immediately with the reason below.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <Button key={r} size="sm" variant={reason === r ? "default" : "outline"} onClick={() => setReason(r)}>
                {r}
              </Button>
            ))}
          </div>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep
            </Button>
            <Button variant="destructive" disabled={busy !== null || reason.trim().length < 3} onClick={() => act({ action: "reject", reason: reason.trim() }, "reject")}>
              {busy === "reject" && <Spinner />} Decline ride
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
