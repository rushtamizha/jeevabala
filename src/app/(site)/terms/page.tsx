import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { getSetting } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Terms of service" };

export default async function TermsPage() {
  const [b, p] = await Promise.all([getSetting("business"), getSetting("pricing")]);
  return (
    <LegalPage title="Terms of service" updated="September 2026">
      <section>
        <p>These terms govern bookings made with {b.name}. By booking a ride you agree to them.</p>
      </section>
      <section>
        <h2>Bookings</h2>
        <ul>
          <li>A booking is a request until the driver confirms it. You’ll be notified of confirmation or if we can’t take the ride.</li>
          <li>Please provide accurate pickup details and be ready at the scheduled time. Share your Ride PIN only with the driver when you board.</li>
          <li>The number of passengers and luggage must not exceed the vehicle’s capacity.</li>
        </ul>
      </section>
      <section>
        <h2>Fares</h2>
        <ul>
          <li>The fare shown before booking is an estimate based on route distance and our published rates.</li>
          <li>The final fare is calculated from actual kilometres/hours travelled, plus tolls, parking, permits and waiting charges where applicable.</li>
          {p.nightCharge.enabled && <li>A night charge of {p.nightCharge.percent}% applies to pickups between {p.nightCharge.startHour}:00 and {p.nightCharge.endHour}:00.</li>}
          <li>Payment is due at the end of the trip by UPI or cash.</li>
        </ul>
      </section>
      <section>
        <h2>Conduct & safety</h2>
        <p>Smoking, alcohol consumption and carrying illegal or hazardous items in the vehicle are not permitted. The driver may refuse or end a trip if safety is at risk.</p>
      </section>
      <section>
        <h2>Liability</h2>
        <p>We take every care to be on time, but we are not liable for delays caused by traffic, weather, road closures or other events beyond our control. Please keep valuables with you.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>{b.name}{b.address ? `, ${b.address}` : ""}. {b.phone && `Phone ${b.phone}.`} {b.email && `Email ${b.email}.`}</p>
      </section>
    </LegalPage>
  );
}
