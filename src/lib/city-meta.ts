/**
 * Presentation metadata for city pages, derived from the slug and district so
 * it needs no schema changes: which region a city sits in (navigation and the
 * /cities directory), what kind of place it is (card artwork and travel-guide
 * copy), and a stable artwork variant so neighbouring cards never look alike.
 */

export type CityRegion = "north" | "west" | "central" | "south" | "other";
export type CityTheme = "city" | "temple" | "hills" | "coast";

export const REGION_LABEL: Record<CityRegion, string> = {
  north: "Chennai & North",
  west: "Kongu & West",
  central: "Central & Delta",
  south: "South Tamil Nadu",
  other: "Neighbouring states",
};

export const REGION_BLURB: Record<CityRegion, string> = {
  north: "Chennai, its suburbs and the northern districts up to Vellore, Hosur and Cuddalore.",
  west: "Coimbatore, Tiruppur, Erode, Salem and the Nilgiris hill stations.",
  central: "Trichy, Thanjavur and the Cauvery delta temple towns.",
  south: "Madurai down to Kanyakumari, the southern hills and the Gulf of Mannar coast.",
  other: "Bengaluru, Puducherry, Tirupati and other cross-border destinations.",
};

const DISTRICT_REGION: Record<string, CityRegion> = {
  Chennai: "north",
  Chengalpattu: "north",
  Kanchipuram: "north",
  Tiruvallur: "north",
  Vellore: "north",
  Ranipet: "north",
  Tirupathur: "north",
  Tiruvannamalai: "north",
  Viluppuram: "north",
  Kallakurichi: "north",
  Cuddalore: "north",
  Krishnagiri: "north",
  Dharmapuri: "north",
  Coimbatore: "west",
  Tiruppur: "west",
  Erode: "west",
  Salem: "west",
  Namakkal: "west",
  Nilgiris: "west",
  Tiruchirappalli: "central",
  Thanjavur: "central",
  Tiruvarur: "central",
  Nagapattinam: "central",
  Mayiladuthurai: "central",
  Pudukkottai: "central",
  Perambalur: "central",
  Ariyalur: "central",
  Karur: "central",
  Madurai: "south",
  Dindigul: "south",
  Theni: "south",
  Sivaganga: "south",
  Ramanathapuram: "south",
  Virudhunagar: "south",
  Thoothukudi: "south",
  Tirunelveli: "south",
  Tenkasi: "south",
  Kanyakumari: "south",
};

const HILLS = new Set(["ooty", "coonoor", "kotagiri", "kodaikanal", "yercaud", "valparai", "yelagiri", "kolli-hills", "courtallam", "hogenakkal", "mettupalayam", "bodinayakanur", "cumbum", "periyakulam", "theni", "tenkasi", "pollachi", "sathyamangalam", "ambasamudram", "mettur", "mysuru"]);
const COAST = new Set(["kanyakumari", "rameswaram", "puducherry", "mahabalipuram", "nagapattinam", "velankanni", "cuddalore", "thoothukudi", "tiruchendur", "karaikal", "vedaranyam", "ramanathapuram", "nagercoil", "pattukkottai", "sirkazhi"]);
const TEMPLE = new Set(["madurai", "thanjavur", "kumbakonam", "srirangam", "trichy", "tiruvannamalai", "kanchipuram", "palani", "chidambaram", "srivilliputhur", "tiruvarur", "mayiladuthurai", "tiruttani", "sankarankovil", "mannargudi", "tirupati", "dindigul", "karaikudi", "devakottai", "sivaganga", "tiruchengode", "gingee", "vriddhachalam", "avinashi", "kulithalai", "melur", "arani", "tirunelveli", "virudhunagar", "pudukkottai", "ariyalur", "perambalur"]);

export const HILL_STATIONS = new Set(["ooty", "coonoor", "kotagiri", "kodaikanal", "yercaud", "valparai", "yelagiri", "kolli-hills"]);

type CityLike = { slug: string; state: string; district: string | null };

export function cityRegion(c: CityLike): CityRegion {
  if (c.state !== "Tamil Nadu") return "other";
  return (c.district && DISTRICT_REGION[c.district]) || "north";
}

export function cityTheme(slug: string): CityTheme {
  if (HILLS.has(slug)) return "hills";
  if (COAST.has(slug)) return "coast";
  if (TEMPLE.has(slug)) return "temple";
  return "city";
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Static illustration for a city card (3 times-of-day per theme, optionally
 * mirrored). In grids pass the card's index so neighbours never share a scene.
 */
export function cityArt(slug: string, index?: number) {
  const h = hash(slug);
  const variant = index === undefined ? h % 3 : index % 3;
  return { src: `/images/cities/${cityTheme(slug)}-${variant}.svg`, flip: (h >> 3) % 2 === 1 };
}

export const THEME_LABEL: Record<CityTheme, string> = {
  city: "City & business travel",
  temple: "Temple town",
  hills: "Hills & nature",
  coast: "Coastal getaway",
};
