"use client";

import { RefreshCwIcon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api-client";

export function AdminNote({ bookingId, initial }: { bookingId: string; initial: string }) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <Textarea value={v} onChange={(e) => setV(e.target.value)} rows={3} maxLength={2000} placeholder="Private notes (never shown to the customer)" />
      <Button
        size="sm"
        variant="outline"
        disabled={busy || v === initial}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`/api/admin/bookings/${bookingId}/action`, { body: { action: "note", adminNote: v } });
            toast.success("Note saved");
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Spinner /> : <SaveIcon />} Save note
      </Button>
    </div>
  );
}

export function RetryNotification({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="icon-xs"
      variant="ghost"
      aria-label="Retry"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/api/admin/notifications/${id}/retry`, { body: {} });
          toast.success("Retried");
          router.refresh();
        } catch (err) {
          toast.error(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Spinner /> : <RefreshCwIcon />}
    </Button>
  );
}
