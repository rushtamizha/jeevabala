import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { getSetting } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Cancellation & refund policy" };

export default async function CancellationPage() {
  const bk = await getSetting("booking");
  const cutoff = bk.customerCancelCutoffMinutes;
  const cutoffText = cutoff >= 60 ? `${Math.round(cutoff / 60)} hour${cutoff >= 120 ? "s" : ""}` : `${cutoff} minutes`;
  return (
    <LegalPage title="Cancellation & refund policy" updated="September 2026">
      <section>
        <h2>Cancelling a ride</h2>
        <ul>
          <li>Pending requests can be cancelled anytime from your dashboard, free of charge.</li>
          <li>Confirmed rides can be cancelled free of charge up to {cutoffText} before pickup.</li>
          <li>Once the driver has started towards your pickup point, please call the driver to cancel.</li>
        </ul>
      </section>
      <section>
        <h2>If we cancel</h2>
        <p>If we are unable to serve a confirmed ride, you’ll be notified immediately and no charges apply. Any reward credits used are returned to your account automatically.</p>
      </section>
      <section>
        <h2>Payments & refunds</h2>
        <p>Because payment is collected only after the trip, there are no advance payments to refund. If you believe you were charged incorrectly, contact us within 7 days with your booking ID and we’ll review it promptly; approved refunds are returned to the original UPI account.</p>
      </section>
    </LegalPage>
  );
}
