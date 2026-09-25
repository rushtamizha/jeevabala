import type { CityTheme } from "./city-meta";

/**
 * Long-form copy for city landing pages. Everything is composed from the
 * city's own data (district, attractions, airport, distances, fares) plus a
 * theme, so each of the 100+ pages reads as a distinct local guide rather
 * than a template with the name swapped.
 */

type CityFacts = {
  name: string;
  district: string | null;
  state: string;
  brand: string;
  theme: CityTheme;
  attractions: string[];
  airport: { name: string; km: number; own: boolean } | null;
  minRate: string;
  minBata: string;
  nearest: { name: string; km: number; fare: string }[];
};

const districtPhrase = (f: CityFacts) => (f.district && f.district !== f.name ? `${f.name} and the rest of ${f.district} district` : `${f.name} and its suburbs`);

export function cityIntro(f: CityFacts): string[] {
  const first = `Looking for a reliable taxi in ${f.name}? ${f.brand} runs one-way drop taxis, round-trip outstation cabs, airport transfers and local hourly call taxis across ${districtPhrase(f)}. Every trip is driven by a verified, courteous driver, and you see an itemised fare — from ${f.minRate}/km with a ${f.minBata} daily driver bata — before you confirm. No surge pricing, no hidden charges, and you pay only after the ride.`;
  const byTheme: Record<CityTheme, string> = {
    city: `${f.name} is a busy ${f.state === "Tamil Nadu" ? "Tamil Nadu" : f.state} hub for business travel, hospital visits, college drops and family trips, so most of our bookings here are early-morning airport runs, railway station pickups and one-way drops to neighbouring cities. Our drivers know the bypass roads and peak-hour bottlenecks, which keeps outstation departures on schedule.`,
    temple: `${f.name} is one of Tamil Nadu's great temple destinations${f.attractions[0] ? `, home to ${f.attractions[0]}` : ""}. Pilgrims book us for darshan-timed pickups, multi-temple circuits and round trips from Chennai, Coimbatore and Bengaluru — the driver waits while you visit, so you never haggle for autos between shrines.`,
    hills: `${f.name} sits on steep ghat roads, so the driver matters as much as the car. Our hill-trained drivers handle the hairpin bends calmly, plan fuel and rest stops before the climb, and know where the viewpoints and waterfalls are${f.attractions[0] ? ` — including ${f.attractions[0]}` : ""}.`,
    coast: `${f.name} is on Tamil Nadu's coast, and trips here are all about timing — sunrise points, beach stops and temple visits that follow the tide and the season. Our drivers know the ECR and coastal highway stretches, the safe parking spots near the shore and the quickest way back before the evening rush${f.attractions[0] ? `. Most visitors start with ${f.attractions[0]}` : ""}.`,
  };
  return [first, byTheme[f.theme]];
}

export function cityTips(f: CityFacts): { title: string; body: string }[] {
  const common = [
    { title: "Book a day ahead for early starts", body: `Pickups before 6 AM from ${f.name} fill up fast on weekends and festival days — booking the evening before guarantees your driver.` },
    { title: "Tolls and parking are actuals", body: "Highway tolls, parking and inter-state permits are paid as they come and added to the final bill, exactly as on the receipts." },
  ];
  const byTheme: Record<CityTheme, { title: string; body: string }[]> = {
    city: [
      { title: "Beat the peak hours", body: `Leave ${f.name} before 7 AM or after 8 PM for outstation trips to skip office traffic on the main arterial roads.` },
      { title: "Add your flight or train number", body: "Put it in the booking note — the driver tracks delays and adjusts the pickup time without extra charge." },
    ],
    temple: [
      { title: "Plan around darshan timings", body: "Most temples close in the afternoon (roughly 12:30–4 PM). Tell us your temple list and the driver sequences the circuit so you don't wait at closed gates." },
      { title: "Festival days need a buffer", body: "On festival and full-moon days, roads near the temple are diverted. Allow an extra hour and let the driver pick the drop point." },
    ],
    hills: [
      { title: "Choose a sedan or SUV for the ghats", body: "For steep climbs with luggage, an SUV or Innova is more comfortable; the AC is switched off on the steepest stretches for safety, as is standard on ghat roads." },
      { title: "Carry a light jacket", body: "Temperatures drop quickly after sunset, especially between November and February. Motion-sickness tablets help on the hairpin bends." },
    ],
    coast: [
      { title: "Go early for sunrise and the beach", body: "Sunrise points get crowded by 6 AM on weekends — the driver can pick you up in the dark and have you there in time." },
      { title: "Monsoon runs from October to December", body: "Heavy north-east monsoon showers can slow coastal roads; we keep a time buffer on airport and train connections during these months." },
    ],
  };
  return [...byTheme[f.theme], ...common];
}

export function airportParagraph(f: CityFacts): string {
  if (!f.airport) return `We run station and bus-stand transfers across ${f.name} with punctual, pre-booked pickups, and connect you to the nearest airport on request.`;
  if (f.airport.own) return `We serve ${f.airport.name} round the clock with fixed-base airport fares. Add your flight number in the booking note — your driver tracks delays and waits at arrivals, so you never pay for the flight being late.`;
  return `The nearest airport to ${f.name} is ${f.airport.name}, about ${f.airport.km} km away by road. Book a one-way airport drop or an arrival pickup — the driver tracks your flight and waits at arrivals with no extra charge for delays.`;
}

export function cityFaqs(f: CityFacts & { vehicles: string; routeCount: number }): { q: string; a: string }[] {
  const n = f.nearest[0];
  return [
    { q: `How much does a taxi in ${f.name} cost?`, a: `One-way drop taxis from ${f.name} start at ${f.minRate}/km with a driver bata of ${f.minBata} per day. Round trips, airport transfers and local hourly packages are also available — the booking form shows your exact, itemised fare before you confirm.` },
    ...(n ? [{ q: `What is the taxi fare from ${f.name} to ${n.name}?`, a: `A one-way drop from ${f.name} to ${n.name} (about ${n.km} km) starts from ${n.fare} in our most affordable car, including the driver bata. Tolls and parking are charged as actuals.` }] : []),
    { q: `Is a one-way drop taxi available from ${f.name}?`, a: `Yes. With a one-way drop you pay only for the distance you travel — there is no return fare, even for long trips to Chennai, Bengaluru or Coimbatore.` },
    { q: `Do you have an airport taxi in ${f.name}?`, a: airportParagraph(f) },
    { q: `Can I book a call taxi in ${f.name} for local use?`, a: `Yes — local hourly packages (4, 8 and 12 hours) cover shopping, hospital visits, functions and sightseeing in ${f.name}, with unlimited stops and fair extra-hour billing.` },
    { q: `Which cars can I book in ${f.name}?`, a: `${f.vehicles}. Choose AC or non-AC where available — every car is cleaned before each trip.` },
    { q: `Is it safe to book a taxi in ${f.name} at night?`, a: `Yes. Every booking has a private Ride PIN, the driver is background-verified, and you can share live trip status with family. We run 24×7, including late-night airport and station pickups.` },
    ...(f.routeCount ? [{ q: `Which outstation trips from ${f.name} are most popular?`, a: `Riders from ${f.name} most often book ${f.nearest.slice(0, 4).map((x) => x.name).join(", ")}${f.nearest.length ? "" : "nearby cities"} — see the outstation section on this page for distances and starting fares.` }] : []),
  ];
}
