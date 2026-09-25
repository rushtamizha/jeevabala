"use client";

import { BanIcon, CoinsIcon, SaveIcon, ShieldCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api, errorMessage } from "@/lib/api-client";
import { formatINR, toPaise } from "@/lib/format";
import { FormField, TextArea, TextInput } from "./form-kit";

export function CustomerActions({ id, status, note, balance }: { id: string; status: "ACTIVE" | "BLOCKED"; note: string; balance: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [n, setN] = useState(note);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const patch = async (key: string, body: Record<string, unknown>, ok: string) => {
    setBusy(key);
    try {
      await api(`/api/admin/customers/${id}`, { method: "PATCH", body });
      toast.success(ok);
      router.refresh();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-5">
      <FormField label="Private note">
        <TextArea value={n} onChange={setN} rows={3} maxLength={2000} placeholder="Preferences, landmarks, VIP…" />
      </FormField>
      <Button size="sm" variant="outline" disabled={busy !== null || n === note} onClick={() => patch("note", { adminNote: n }, "Note saved")}>
        {busy === "note" ? <Spinner /> : <SaveIcon />} Save note
      </Button>
      <div className="space-y-2 border-t pt-4">
        <p className="text-sm font-medium">Reward credits · <span className="tabular">{formatINR(balance)}</span></p>
        <div className="grid grid-cols-2 gap-2">
          <TextInput value={amount} onChange={(x) => setAmount(x.replace(/[^\d.-]/g, ""))} placeholder="± amount (₹)" inputMode="decimal" />
          <TextInput value={reason} onChange={setReason} placeholder="Reason" maxLength={120} />
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null || !Number(amount)}
          onClick={async () => {
            if (await patch("credit", { creditAdjustment: toPaise(Number(amount)), creditNote: reason || undefined }, "Credits updated")) {
              setAmount("");
              setReason("");
            }
          }}
        >
          {busy === "credit" ? <Spinner /> : <CoinsIcon />} Apply
        </Button>
      </div>
      <div className="border-t pt-4">
        {status === "ACTIVE" ? (
          <Button variant="destructive" disabled={busy !== null} onClick={() => confirm("Block this customer? They’ll be signed out and can’t book.") && patch("block", { status: "BLOCKED" }, "Customer blocked")}>
            {busy === "block" ? <Spinner /> : <BanIcon />} Block customer
          </Button>
        ) : (
          <Button variant="outline" disabled={busy !== null} onClick={() => patch("unblock", { status: "ACTIVE" }, "Customer unblocked")}>
            {busy === "unblock" ? <Spinner /> : <ShieldCheckIcon />} Unblock
          </Button>
        )}
      </div>
    </div>
  );
}
