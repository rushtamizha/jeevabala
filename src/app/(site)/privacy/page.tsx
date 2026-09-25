import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { getSetting } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Privacy policy" };

export default async function PrivacyPage() {
  const b = await getSetting("business");
  return (
    <LegalPage title="Privacy policy" updated="September 2026">
      <section>
        <p>{b.name} (“we”, “us”) respects your privacy. This policy explains what personal data we collect when you use our website and services, why, and the rights you have under India’s Digital Personal Data Protection Act, 2023.</p>
      </section>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Contact details you give us: name, mobile number and email address.</li>
          <li>Trip details: pickup and drop locations, dates, passengers, notes and fares.</li>
          <li>Payment references you choose to share (e.g. UPI transaction ID). We never collect card or bank credentials.</li>
          <li>Security logs: IP address and browser type, used only to protect accounts and prevent fraud.</li>
        </ul>
      </section>
      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To confirm, operate and bill your rides, and to send ride updates by email or WhatsApp.</li>
          <li>To verify your identity with one-time codes and keep your account secure.</li>
          <li>To run our rewards and referral programme.</li>
          <li>To meet legal, tax and accounting obligations.</li>
        </ul>
        <p className="mt-3">We do not sell your data or use it for third-party advertising.</p>
      </section>
      <section>
        <h2>Sharing</h2>
        <p>We share data only with service providers needed to run the service (email delivery, messaging, maps and hosting), under confidentiality obligations, or when required by law.</p>
      </section>
      <section>
        <h2>Security</h2>
        <p>Data is transmitted over HTTPS, sessions use secure http-only cookies, verification codes are stored only as cryptographic hashes and integration secrets are encrypted at rest. Access to the driver console is protected with strong passwords, rate limiting and two-factor authentication.</p>
      </section>
      <section>
        <h2>Retention & your rights</h2>
        <p>You can download a copy of your data or delete your account at any time from your profile. When you delete your account we erase your personal details; anonymised trip invoices are kept as required for accounting. For any request, contact {b.email || b.phone || "us"}.</p>
      </section>
    </LegalPage>
  );
}
