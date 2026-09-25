/**
 * Default catalogue: fleet, SEO city pages and popular routes. Everything here is
 * editable in Admin → Fleet / Cities / Routes; the seed only inserts missing rows.
 * Rates are integer paise.
 */
import type { VehicleCategory, VehicleRates } from "../lib/types";

export type SeedVehicle = {
  slug: string;
  category: VehicleCategory;
  name: string;
  model: string;
  description: string;
  seats: number;
  luggage: number;
  hasAc: boolean;
  features: string[];
  rates: VehicleRates;
  sortOrder: number;
};

const r = (rupees: number) => rupees * 100;

export const SEED_VEHICLES: SeedVehicle[] = [
  {
    slug: "hatchback",
    category: "HATCHBACK",
    name: "Hatchback",
    model: "Maruti Swift / WagonR",
    description: "Budget-friendly and nimble — perfect for solo travellers, couples and quick city rides.",
    seats: 4,
    luggage: 1,
    hasAc: true,
    features: ["Air conditioning", "Phone charger", "Music system"],
    rates: { oneWayAcPerKm: r(13), oneWayNonAcPerKm: r(12), roundTripAcPerKm: r(12), roundTripNonAcPerKm: r(11), driverBataPerDay: r(400), airportAcBase: r(500), airportNonAcBase: r(450), airportAcPerKm: r(16), airportNonAcPerKm: r(15), localMultiplierPct: 90 },
    sortOrder: 0,
  },
  {
    slug: "sedan",
    category: "SEDAN",
    name: "Sedan",
    model: "Swift Dzire / Toyota Etios",
    description: "Our most booked car — a comfortable boot for 2 large bags and a smooth highway ride.",
    seats: 4,
    luggage: 2,
    hasAc: true,
    features: ["Air conditioning", "Spacious boot", "Phone charger", "First-aid kit"],
    rates: { oneWayAcPerKm: r(14), oneWayNonAcPerKm: r(13), roundTripAcPerKm: r(13), roundTripNonAcPerKm: r(12), driverBataPerDay: r(400), airportAcBase: r(600), airportNonAcBase: r(500), airportAcPerKm: r(18), airportNonAcPerKm: r(16), localMultiplierPct: 100 },
    sortOrder: 1,
  },
  {
    slug: "suv",
    category: "SUV",
    name: "SUV",
    model: "Maruti Ertiga / Mahindra Marazzo",
    description: "Six comfortable seats with a third row — great for small families and group outings.",
    seats: 6,
    luggage: 3,
    hasAc: true,
    features: ["Dual AC vents", "6 seats", "Roof carrier on request", "Phone charger"],
    rates: { oneWayAcPerKm: r(19), oneWayNonAcPerKm: r(18), roundTripAcPerKm: r(18), roundTripNonAcPerKm: r(17), driverBataPerDay: r(500), airportAcBase: r(850), airportNonAcBase: r(750), airportAcPerKm: r(22), airportNonAcPerKm: r(20), localMultiplierPct: 135 },
    sortOrder: 2,
  },
  {
    slug: "innova",
    category: "MUV",
    name: "Innova",
    model: "Toyota Innova",
    description: "India’s favourite family car — legendary comfort for long outstation and pilgrimage trips.",
    seats: 7,
    luggage: 3,
    hasAc: true,
    features: ["Rear AC", "7 seats", "Captain seats (on request)", "Extra legroom"],
    rates: { oneWayAcPerKm: r(20), oneWayNonAcPerKm: r(19), roundTripAcPerKm: r(19), roundTripNonAcPerKm: r(18), driverBataPerDay: r(500), airportAcBase: r(950), airportNonAcBase: r(850), airportAcPerKm: r(24), airportNonAcPerKm: r(22), localMultiplierPct: 150 },
    sortOrder: 3,
  },
  {
    slug: "innova-crysta",
    category: "LUXURY",
    name: "Innova Crysta",
    model: "Toyota Innova Crysta",
    description: "Premium MUV with captain seats and a whisper-quiet cabin — ideal for VIPs and airport runs.",
    seats: 7,
    luggage: 4,
    hasAc: true,
    features: ["Captain seats", "Rear AC", "Premium interiors", "USB charging"],
    rates: { oneWayAcPerKm: r(23), roundTripAcPerKm: r(22), driverBataPerDay: r(600), airportAcBase: r(1100), airportAcPerKm: r(26), localMultiplierPct: 175 },
    sortOrder: 4,
  },
  {
    slug: "tempo-traveller",
    category: "TEMPO",
    name: "Tempo Traveller",
    model: "Force Traveller 12-seater",
    description: "Push-back seats and big luggage space for group tours, weddings and temple trips.",
    seats: 12,
    luggage: 8,
    hasAc: true,
    features: ["Push-back seats", "Music system", "Large luggage carrier", "Individual AC vents"],
    rates: { oneWayAcPerKm: r(27), roundTripAcPerKm: r(25), driverBataPerDay: r(700), airportAcBase: r(1800), airportAcPerKm: r(30), localMultiplierPct: 230 },
    sortOrder: 5,
  },
];

export type SeedCity = {
  slug: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  airportName?: string;
  attractions: string[];
  featured?: boolean;
};

const TN = "Tamil Nadu";

export const SEED_CITIES: SeedCity[] = [
  { slug: "chennai", name: "Chennai", district: "Chennai", state: TN, lat: 13.0827, lng: 80.2707, airportName: "Chennai International Airport (MAA)", attractions: ["Marina Beach", "Kapaleeshwarar Temple", "Fort St. George", "Mahabalipuram shore temples"], featured: true },
  { slug: "coimbatore", name: "Coimbatore", district: "Coimbatore", state: TN, lat: 11.0168, lng: 76.9558, airportName: "Coimbatore International Airport (CJB)", attractions: ["Adiyogi at Isha Yoga Center", "Marudhamalai Temple", "Kovai Kutralam Falls", "Siruvani Dam"], featured: true },
  { slug: "madurai", name: "Madurai", district: "Madurai", state: TN, lat: 9.9252, lng: 78.1198, airportName: "Madurai Airport (IXM)", attractions: ["Meenakshi Amman Temple", "Thirumalai Nayak Palace", "Alagar Kovil", "Gandhi Memorial Museum"], featured: true },
  { slug: "trichy", name: "Trichy", district: "Tiruchirappalli", state: TN, lat: 10.7905, lng: 78.7047, airportName: "Tiruchirappalli International Airport (TRZ)", attractions: ["Srirangam Ranganathaswamy Temple", "Rockfort Ucchi Pillayar Temple", "Jambukeswarar Temple", "Mukkombu"], featured: true },
  { slug: "salem", name: "Salem", district: "Salem", state: TN, lat: 11.6643, lng: 78.146, airportName: "Salem Airport (SXV)", attractions: ["Yercaud hill station", "Mettur Dam", "Kottai Mariamman Temple"], featured: true },
  { slug: "ooty", name: "Ooty", district: "Nilgiris", state: TN, lat: 11.4102, lng: 76.695, attractions: ["Ooty Lake", "Government Botanical Garden", "Doddabetta Peak", "Nilgiri Mountain Railway"], featured: true },
  { slug: "tirunelveli", name: "Tirunelveli", district: "Tirunelveli", state: TN, lat: 8.7139, lng: 77.7567, attractions: ["Nellaiappar Temple", "Courtallam Falls", "Manimuthar Dam"], featured: true },
  { slug: "vellore", name: "Vellore", district: "Vellore", state: TN, lat: 12.9165, lng: 79.1325, attractions: ["Sripuram Golden Temple", "Vellore Fort", "CMC Hospital", "Yelagiri Hills"], featured: true },
  { slug: "erode", name: "Erode", district: "Erode", state: TN, lat: 11.341, lng: 77.7172, attractions: ["Bhavani Sagar Dam", "Kodiveri Falls", "Bannari Amman Temple"] },
  { slug: "tiruppur", name: "Tiruppur", district: "Tiruppur", state: TN, lat: 11.1085, lng: 77.3411, attractions: ["Thirumoorthy Falls", "Amaravathi Dam", "Knitwear export hub"] },
  { slug: "thanjavur", name: "Thanjavur", district: "Thanjavur", state: TN, lat: 10.787, lng: 79.1378, attractions: ["Brihadeeswarar Temple", "Thanjavur Palace", "Saraswathi Mahal Library"], featured: true },
  { slug: "kanyakumari", name: "Kanyakumari", district: "Kanyakumari", state: TN, lat: 8.0883, lng: 77.5385, attractions: ["Vivekananda Rock Memorial", "Thiruvalluvar Statue", "Sunrise point", "Padmanabhapuram Palace"], featured: true },
  { slug: "rameswaram", name: "Rameswaram", district: "Ramanathapuram", state: TN, lat: 9.2876, lng: 79.3129, attractions: ["Ramanathaswamy Temple", "Pamban Bridge", "Dhanushkodi", "APJ Abdul Kalam Memorial"], featured: true },
  { slug: "kodaikanal", name: "Kodaikanal", district: "Dindigul", state: TN, lat: 10.2381, lng: 77.4892, attractions: ["Kodai Lake", "Coaker’s Walk", "Pillar Rocks", "Bryant Park"], featured: true },
  { slug: "dindigul", name: "Dindigul", district: "Dindigul", state: TN, lat: 10.3673, lng: 77.9803, attractions: ["Palani Murugan Temple", "Dindigul Rock Fort", "Kodaikanal hills"] },
  { slug: "kanchipuram", name: "Kanchipuram", district: "Kanchipuram", state: TN, lat: 12.8342, lng: 79.7036, attractions: ["Ekambareswarar Temple", "Kamakshi Amman Temple", "Kanchi silk weavers"] },
  { slug: "chengalpattu", name: "Chengalpattu", district: "Chengalpattu", state: TN, lat: 12.6921, lng: 79.9765, attractions: ["Mahabalipuram", "Vedanthangal Bird Sanctuary", "Thirukazhukundram"] },
  { slug: "tiruvallur", name: "Tiruvallur", district: "Tiruvallur", state: TN, lat: 13.1439, lng: 79.9091, attractions: ["Pulicat Lake", "Veeraraghava Swamy Temple", "Poondi Reservoir"] },
  { slug: "tiruvannamalai", name: "Tiruvannamalai", district: "Tiruvannamalai", state: TN, lat: 12.2253, lng: 79.0747, attractions: ["Arunachaleswarar Temple", "Girivalam path", "Ramana Maharshi Ashram"], featured: true },
  { slug: "villupuram", name: "Villupuram", district: "Viluppuram", state: TN, lat: 11.9401, lng: 79.4861, attractions: ["Gingee Fort", "Auroville (nearby)", "Mailam Murugan Temple"] },
  { slug: "cuddalore", name: "Cuddalore", district: "Cuddalore", state: TN, lat: 11.748, lng: 79.7714, attractions: ["Chidambaram Nataraja Temple", "Pichavaram Mangroves", "Silver Beach"] },
  { slug: "nagapattinam", name: "Nagapattinam", district: "Nagapattinam", state: TN, lat: 10.7672, lng: 79.8449, attractions: ["Velankanni Church", "Nagore Dargah", "Kodiakkarai sanctuary"] },
  { slug: "mayiladuthurai", name: "Mayiladuthurai", district: "Mayiladuthurai", state: TN, lat: 11.1018, lng: 79.6528, attractions: ["Mayuranathaswamy Temple", "Tharangambadi (Tranquebar)", "Vaitheeswaran Koil"] },
  { slug: "tiruvarur", name: "Tiruvarur", district: "Tiruvarur", state: TN, lat: 10.7661, lng: 79.6344, attractions: ["Thyagaraja Temple", "Kamalalayam tank", "Muthupet lagoon"] },
  { slug: "kumbakonam", name: "Kumbakonam", district: "Thanjavur", state: TN, lat: 10.9617, lng: 79.3881, attractions: ["Navagraha temples", "Mahamaham tank", "Airavatesvara Temple, Darasuram"] },
  { slug: "pudukkottai", name: "Pudukkottai", district: "Pudukkottai", state: TN, lat: 10.3833, lng: 78.8001, attractions: ["Sittanavasal cave paintings", "Thirumayam Fort", "Avudaiyarkoil"] },
  { slug: "karaikudi", name: "Karaikudi", district: "Sivaganga", state: TN, lat: 10.0735, lng: 78.7732, attractions: ["Chettinad mansions", "Pillaiyarpatti Temple", "Kanadukathan"] },
  { slug: "sivaganga", name: "Sivaganga", district: "Sivaganga", state: TN, lat: 9.8433, lng: 78.4809, attractions: ["Chettinad heritage", "Kalaiyarkoil", "Vettangudi Bird Sanctuary"] },
  { slug: "ramanathapuram", name: "Ramanathapuram", district: "Ramanathapuram", state: TN, lat: 9.3639, lng: 78.8395, attractions: ["Rameswaram", "Uthirakosamangai Temple", "Ramalinga Vilasam Palace"] },
  { slug: "thoothukudi", name: "Thoothukudi", district: "Thoothukudi", state: TN, lat: 8.7642, lng: 78.1348, airportName: "Tuticorin Airport (TCR)", attractions: ["Tiruchendur Murugan Temple", "Panimaya Matha Church", "Harbour beach"] },
  { slug: "tenkasi", name: "Tenkasi", district: "Tenkasi", state: TN, lat: 8.9594, lng: 77.3152, attractions: ["Courtallam waterfalls", "Kasi Viswanathar Temple", "Gundar Dam"] },
  { slug: "virudhunagar", name: "Virudhunagar", district: "Virudhunagar", state: TN, lat: 9.5851, lng: 77.9579, attractions: ["Sivakasi", "Srivilliputhur Andal Temple", "Ayyanar Falls"] },
  { slug: "theni", name: "Theni", district: "Theni", state: TN, lat: 10.0104, lng: 77.4768, attractions: ["Meghamalai", "Suruli Falls", "Vaigai Dam", "Kumily (Thekkady) border"] },
  { slug: "karur", name: "Karur", district: "Karur", state: TN, lat: 10.9601, lng: 78.0766, attractions: ["Kalyana Pasupatheeswarar Temple", "Mayanur barrage", "Textile hub"] },
  { slug: "namakkal", name: "Namakkal", district: "Namakkal", state: TN, lat: 11.2189, lng: 78.1674, attractions: ["Namakkal Anjaneyar Temple", "Kolli Hills", "Namakkal Fort"] },
  { slug: "perambalur", name: "Perambalur", district: "Perambalur", state: TN, lat: 11.2342, lng: 78.8807, attractions: ["Ranjankudi Fort", "Siruvachur Madhura Kaliamman Temple", "Fossil park, Sathanur"] },
  { slug: "ariyalur", name: "Ariyalur", district: "Ariyalur", state: TN, lat: 11.1401, lng: 79.0786, attractions: ["Gangaikonda Cholapuram", "Karaivetti Bird Sanctuary"] },
  { slug: "kallakurichi", name: "Kallakurichi", district: "Kallakurichi", state: TN, lat: 11.738, lng: 78.9639, attractions: ["Kalvarayan Hills", "Gomukhi Dam", "Periyar Falls"] },
  { slug: "dharmapuri", name: "Dharmapuri", district: "Dharmapuri", state: TN, lat: 12.1211, lng: 78.1582, attractions: ["Hogenakkal Falls", "Theerthamalai", "Adhiyamankottai Fort"] },
  { slug: "krishnagiri", name: "Krishnagiri", district: "Krishnagiri", state: TN, lat: 12.5266, lng: 78.2141, attractions: ["Krishnagiri Dam", "Hosur", "Thally (Little England)"] },
  { slug: "hosur", name: "Hosur", district: "Krishnagiri", state: TN, lat: 12.7409, lng: 77.8253, attractions: ["Chandra Chudeshwara Temple", "Kelavarapalli Dam", "Industrial hub near Bengaluru"] },
  { slug: "tirupathur", name: "Tirupathur", district: "Tirupathur", state: TN, lat: 12.4966, lng: 78.5673, attractions: ["Yelagiri Hills", "Jalagamparai Falls"] },
  { slug: "ranipet", name: "Ranipet", district: "Ranipet", state: TN, lat: 12.9224, lng: 79.3326, attractions: ["Sholinghur Narasimha Temple", "Arcot heritage", "Kaveripakkam Lake"] },
  { slug: "pollachi", name: "Pollachi", district: "Coimbatore", state: TN, lat: 10.6609, lng: 77.0081, attractions: ["Aliyar Dam", "Valparai", "Topslip (Anamalai Tiger Reserve)"] },
  // Towns, temple towns, hill stations and coastal stops — so every major Tamil Nadu pickup has its own page.
  { slug: "tambaram", name: "Tambaram", district: "Chengalpattu", state: TN, lat: 12.9249, lng: 80.1, attractions: ["Vandalur Arignar Anna Zoo", "Guindy National Park", "GST Road corridor"] },
  { slug: "avadi", name: "Avadi", district: "Tiruvallur", state: TN, lat: 13.1147, lng: 80.1098, attractions: ["Paruthipattu Lake", "Thiruverkadu Karumariamman Temple", "Poonamallee"] },
  { slug: "sriperumbudur", name: "Sriperumbudur", district: "Kanchipuram", state: TN, lat: 12.9675, lng: 79.9419, attractions: ["Adikesava Perumal Temple", "Rajiv Gandhi Memorial", "Industrial corridor"] },
  { slug: "mahabalipuram", name: "Mahabalipuram", district: "Chengalpattu", state: TN, lat: 12.6208, lng: 80.1945, attractions: ["Shore Temple", "Pancha Rathas", "Arjuna’s Penance", "Mamallapuram beach"] },
  { slug: "tiruttani", name: "Tiruttani", district: "Tiruvallur", state: TN, lat: 13.1766, lng: 79.6166, attractions: ["Tiruttani Murugan Temple", "Nandi River", "Pallipattu"] },
  { slug: "arakkonam", name: "Arakkonam", district: "Ranipet", state: TN, lat: 13.0843, lng: 79.6706, attractions: ["Arakkonam Junction", "Sholinghur Temple", "Takkolam"] },
  { slug: "ambur", name: "Ambur", district: "Tirupathur", state: TN, lat: 12.7916, lng: 78.7166, attractions: ["Ambur biryani", "Leather cluster", "Yelagiri Hills"] },
  { slug: "vaniyambadi", name: "Vaniyambadi", district: "Tirupathur", state: TN, lat: 12.682, lng: 78.6208, attractions: ["Yelagiri Hills", "Jalagamparai Falls", "Palar river"] },
  { slug: "gudiyatham", name: "Gudiyatham", district: "Vellore", state: TN, lat: 12.9447, lng: 78.8731, attractions: ["Gangaiamman Temple", "Mordhana Dam", "Handloom weavers"] },
  { slug: "arani", name: "Arani", district: "Tiruvannamalai", state: TN, lat: 12.6695, lng: 79.2846, attractions: ["Arani silk sarees", "Arani Fort", "Padavedu Renugambal Temple"] },
  { slug: "gingee", name: "Gingee", district: "Viluppuram", state: TN, lat: 12.2528, lng: 79.4163, attractions: ["Gingee Fort (Rajagiri & Krishnagiri)", "Venkataramana Temple", "Melmalayanur"] },
  { slug: "tindivanam", name: "Tindivanam", district: "Viluppuram", state: TN, lat: 12.234, lng: 79.655, attractions: ["Tiruvakkarai fossil park", "Mailam Murugan Temple", "Marakkanam beach"] },
  { slug: "chidambaram", name: "Chidambaram", district: "Cuddalore", state: TN, lat: 11.3993, lng: 79.6937, attractions: ["Thillai Nataraja Temple", "Pichavaram Mangrove Forest", "Annamalai University"] },
  { slug: "neyveli", name: "Neyveli", district: "Cuddalore", state: TN, lat: 11.5463, lng: 79.4764, attractions: ["NLC township", "Vadalur Sathya Gnana Sabai", "Neyveli lake"] },
  { slug: "vriddhachalam", name: "Vriddhachalam", district: "Cuddalore", state: TN, lat: 11.5183, lng: 79.3242, attractions: ["Vriddhagiriswarar Temple", "Manimuktha river", "Ceramic cluster"] },
  { slug: "mettupalayam", name: "Mettupalayam", district: "Coimbatore", state: TN, lat: 11.299, lng: 76.935, attractions: ["Nilgiri Mountain Railway start", "Bhavani river", "Black Thunder theme park"] },
  { slug: "coonoor", name: "Coonoor", district: "Nilgiris", state: TN, lat: 11.353, lng: 76.7959, attractions: ["Sim’s Park", "Dolphin’s Nose", "Lamb’s Rock", "Tea estates"] },
  { slug: "kotagiri", name: "Kotagiri", district: "Nilgiris", state: TN, lat: 11.4212, lng: 76.8615, attractions: ["Catherine Falls", "Kodanad View Point", "Longwood Shola"] },
  { slug: "valparai", name: "Valparai", district: "Coimbatore", state: TN, lat: 10.3269, lng: 76.9553, attractions: ["Aliyar hairpin road", "Sholayar Dam", "Nallamudi viewpoint", "Tea gardens"] },
  { slug: "udumalaipettai", name: "Udumalaipettai", district: "Tiruppur", state: TN, lat: 10.588, lng: 77.2476, attractions: ["Thirumoorthy Falls", "Amaravathi Dam", "Chinnar wildlife border"] },
  { slug: "dharapuram", name: "Dharapuram", district: "Tiruppur", state: TN, lat: 10.7381, lng: 77.5313, attractions: ["Amaravathi river", "Agastheeswarar Temple"] },
  { slug: "avinashi", name: "Avinashi", district: "Tiruppur", state: TN, lat: 11.1928, lng: 77.2687, attractions: ["Avinashilingeswarar Temple", "NH 544 corridor"] },
  { slug: "palladam", name: "Palladam", district: "Tiruppur", state: TN, lat: 10.9903, lng: 77.2839, attractions: ["Textile clusters", "Sulur", "Kovai–Tiruppur highway"] },
  { slug: "kangeyam", name: "Kangeyam", district: "Tiruppur", state: TN, lat: 11.0062, lng: 77.5619, attractions: ["Sivanmalai Murugan Temple", "Kangayam bull breed", "Rice mills"] },
  { slug: "perundurai", name: "Perundurai", district: "Erode", state: TN, lat: 11.2755, lng: 77.5876, attractions: ["SIPCOT industrial park", "Chennimalai Murugan Temple"] },
  { slug: "gobichettipalayam", name: "Gobichettipalayam", district: "Erode", state: TN, lat: 11.455, lng: 77.442, attractions: ["Kodiveri Dam", "Pachaimalai Murugan Temple", "Film-shoot paddy fields"] },
  { slug: "sathyamangalam", name: "Sathyamangalam", district: "Erode", state: TN, lat: 11.5048, lng: 77.2384, attractions: ["Bannari Amman Temple", "Sathyamangalam Tiger Reserve", "Bhavanisagar Dam"] },
  { slug: "bhavani", name: "Bhavani", district: "Erode", state: TN, lat: 11.4455, lng: 77.6821, attractions: ["Sangameswarar Temple (Kooduthurai)", "Bhavani jamakkalam carpets"] },
  { slug: "tiruchengode", name: "Tiruchengode", district: "Namakkal", state: TN, lat: 11.3793, lng: 77.8943, attractions: ["Ardhanareeswarar Hill Temple", "Lorry-body building hub"] },
  { slug: "rasipuram", name: "Rasipuram", district: "Namakkal", state: TN, lat: 11.46, lng: 78.185, attractions: ["Kolli Hills", "Nithya Sumangali Mariamman Temple"] },
  { slug: "kolli-hills", name: "Kolli Hills", district: "Namakkal", state: TN, lat: 11.2485, lng: 78.3383, attractions: ["70 hairpin bends", "Agaya Gangai Falls", "Arapaleeswarar Temple", "Seekuparai viewpoint"] },
  { slug: "attur", name: "Attur", district: "Salem", state: TN, lat: 11.597, lng: 78.601, attractions: ["Attur Fort", "Kalvarayan Hills", "Mettur–Attur highway"] },
  { slug: "yercaud", name: "Yercaud", district: "Salem", state: TN, lat: 11.7753, lng: 78.2093, attractions: ["Yercaud Lake", "Lady’s Seat", "Shevaroy Temple", "Kiliyur Falls"] },
  { slug: "mettur", name: "Mettur", district: "Salem", state: TN, lat: 11.7865, lng: 77.8005, attractions: ["Mettur Dam (Stanley Reservoir)", "Mettur Park", "Hogenakkal (nearby)"] },
  { slug: "hogenakkal", name: "Hogenakkal", district: "Dharmapuri", state: TN, lat: 12.119, lng: 77.779, attractions: ["Hogenakkal Falls", "Coracle rides", "Fresh fish fry stalls"] },
  { slug: "yelagiri", name: "Yelagiri", district: "Tirupathur", state: TN, lat: 12.581, lng: 78.6376, attractions: ["Punganoor Lake", "Swamimalai trek", "Jalagamparai Falls", "14 hairpin bends"] },
  { slug: "palani", name: "Palani", district: "Dindigul", state: TN, lat: 10.45, lng: 77.52, attractions: ["Palani Murugan Temple (winch & rope car)", "Idumban Hill", "Kodaikanal ghat road"] },
  { slug: "bodinayakanur", name: "Bodinayakanur", district: "Theni", state: TN, lat: 10.0101, lng: 77.3496, attractions: ["Bodi Mettu ghat road", "Cardamom estates", "Munnar border"] },
  { slug: "cumbum", name: "Cumbum", district: "Theni", state: TN, lat: 9.737, lng: 77.281, attractions: ["Grape vineyards", "Suruli Falls", "Thekkady border"] },
  { slug: "periyakulam", name: "Periyakulam", district: "Theni", state: TN, lat: 10.1239, lng: 77.5452, attractions: ["Kumbakkarai Falls", "Mango orchards", "Kodaikanal foothills"] },
  { slug: "thirumangalam", name: "Thirumangalam", district: "Madurai", state: TN, lat: 9.8216, lng: 77.9833, attractions: ["Madurai–Tirunelveli highway", "Kallupatti"] },
  { slug: "melur", name: "Melur", district: "Madurai", state: TN, lat: 10.0317, lng: 78.3385, attractions: ["Alagar Kovil", "Keezhavalavu Jain beds"] },
  { slug: "sivakasi", name: "Sivakasi", district: "Virudhunagar", state: TN, lat: 9.4533, lng: 77.8024, attractions: ["Fireworks & printing hub", "Bhadrakali Amman Temple", "Srivilliputhur"] },
  { slug: "rajapalayam", name: "Rajapalayam", district: "Virudhunagar", state: TN, lat: 9.4515, lng: 77.553, attractions: ["Ayyanar Falls", "Shenbagathope", "Rajapalayam hound breed"] },
  { slug: "srivilliputhur", name: "Srivilliputhur", district: "Virudhunagar", state: TN, lat: 9.5121, lng: 77.633, attractions: ["Andal Temple", "Srivilliputhur palkova", "Grizzled Squirrel Sanctuary"] },
  { slug: "aruppukottai", name: "Aruppukottai", district: "Virudhunagar", state: TN, lat: 9.5096, lng: 78.096, attractions: ["Sokkanathaswamy Temple", "Handloom weavers"] },
  { slug: "kovilpatti", name: "Kovilpatti", district: "Thoothukudi", state: TN, lat: 9.1717, lng: 77.8697, attractions: ["Kovilpatti kadalai mittai", "Kazhugumalai Jain beds"] },
  { slug: "tiruchendur", name: "Tiruchendur", district: "Thoothukudi", state: TN, lat: 8.4964, lng: 78.1255, attractions: ["Tiruchendur Murugan Temple (seashore)", "Valli Cave", "Kulasekarapattinam Dasara"] },
  { slug: "nagercoil", name: "Nagercoil", district: "Kanyakumari", state: TN, lat: 8.1833, lng: 77.4119, attractions: ["Nagaraja Temple", "Padmanabhapuram Palace", "Kanyakumari (20 km)"] },
  { slug: "marthandam", name: "Marthandam", district: "Kanyakumari", state: TN, lat: 8.307, lng: 77.2225, attractions: ["Thirparappu Falls", "Mathur Aqueduct", "Thiruvananthapuram (Kerala) border"] },
  { slug: "courtallam", name: "Courtallam", district: "Tenkasi", state: TN, lat: 8.9337, lng: 77.2784, attractions: ["Main Falls (Peraruvi)", "Five Falls (Aintharuvi)", "Old Courtallam", "Kutralanathar Temple"] },
  { slug: "sankarankovil", name: "Sankarankovil", district: "Tenkasi", state: TN, lat: 9.1707, lng: 77.5427, attractions: ["Sankaranarayanar Temple", "Aadi Thabasu festival"] },
  { slug: "ambasamudram", name: "Ambasamudram", district: "Tirunelveli", state: TN, lat: 8.7076, lng: 77.453, attractions: ["Papanasam Falls", "Manimuthar Falls", "Mundanthurai Tiger Reserve"] },
  { slug: "paramakudi", name: "Paramakudi", district: "Ramanathapuram", state: TN, lat: 9.5446, lng: 78.5905, attractions: ["Emaneswaram Temple", "Madurai–Rameswaram highway"] },
  { slug: "devakottai", name: "Devakottai", district: "Sivaganga", state: TN, lat: 9.9477, lng: 78.823, attractions: ["Chettinad mansions", "Karaikudi (15 km)"] },
  { slug: "srirangam", name: "Srirangam", district: "Tiruchirappalli", state: TN, lat: 10.8628, lng: 78.69, attractions: ["Sri Ranganathaswamy Temple", "Jambukeswarar Temple, Thiruvanaikaval", "Amma Mandapam ghat"] },
  { slug: "manapparai", name: "Manapparai", district: "Tiruchirappalli", state: TN, lat: 10.6077, lng: 78.4252, attractions: ["Manapparai murukku", "Cattle market", "Trichy–Madurai highway"] },
  { slug: "kulithalai", name: "Kulithalai", district: "Karur", state: TN, lat: 10.9356, lng: 78.4212, attractions: ["Kadambavaneswarar Temple", "Cauvery riverfront", "Ayyarmalai"] },
  { slug: "mannargudi", name: "Mannargudi", district: "Tiruvarur", state: TN, lat: 10.6653, lng: 79.4521, attractions: ["Rajagopalaswamy Temple", "Haridra Nadhi tank", "Vaduvur Bird Sanctuary"] },
  { slug: "pattukkottai", name: "Pattukkottai", district: "Thanjavur", state: TN, lat: 10.423, lng: 79.3196, attractions: ["Manora Fort", "Adirampattinam beach", "Coconut groves"] },
  { slug: "velankanni", name: "Velankanni", district: "Nagapattinam", state: TN, lat: 10.6817, lng: 79.8508, attractions: ["Basilica of Our Lady of Good Health", "Velankanni beach", "Nagore Dargah (12 km)"] },
  { slug: "vedaranyam", name: "Vedaranyam", district: "Nagapattinam", state: TN, lat: 10.3754, lng: 79.8505, attractions: ["Point Calimere (Kodiakkarai) Sanctuary", "Vedaranyeswarar Temple", "Salt pans"] },
  { slug: "sirkazhi", name: "Sirkazhi", district: "Mayiladuthurai", state: TN, lat: 11.2386, lng: 79.7363, attractions: ["Sattainathar Temple", "Vaitheeswaran Koil", "Poompuhar beach"] },
  { slug: "karaikal", name: "Karaikal", district: "Karaikal", state: "Puducherry", lat: 10.9254, lng: 79.838, attractions: ["Thirunallar Saneeswaran Temple", "Karaikal beach", "Karaikal Ammaiyar Temple"] },
  { slug: "bengaluru", name: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", lat: 12.9716, lng: 77.5946, airportName: "Kempegowda International Airport (BLR)", attractions: ["Lalbagh Botanical Garden", "Bangalore Palace", "Nandi Hills"], featured: true },
  { slug: "puducherry", name: "Puducherry", district: "Puducherry", state: "Puducherry", lat: 11.9416, lng: 79.8083, attractions: ["Promenade Beach", "White Town", "Auroville", "Paradise Beach"], featured: true },
  { slug: "tirupati", name: "Tirupati", district: "Tirupati", state: "Andhra Pradesh", lat: 13.6288, lng: 79.4192, airportName: "Tirupati Airport (TIR)", attractions: ["Tirumala Venkateswara Temple", "Sri Kalahasti", "Talakona Falls"], featured: true },
  { slug: "mysuru", name: "Mysuru", district: "Mysuru", state: "Karnataka", lat: 12.2958, lng: 76.6394, attractions: ["Mysore Palace", "Chamundi Hills", "Brindavan Gardens"] },
];

export type SeedRoute = { from: string; to: string; km: number; featured?: boolean };

/** Road distances (approx.). Durations are derived at ~52 km/h average including breaks. */
export const SEED_ROUTES: SeedRoute[] = [
  { from: "chennai", to: "bengaluru", km: 346, featured: true },
  { from: "chennai", to: "puducherry", km: 151, featured: true },
  { from: "chennai", to: "tirupati", km: 135, featured: true },
  { from: "chennai", to: "vellore", km: 140, featured: true },
  { from: "chennai", to: "madurai", km: 462, featured: true },
  { from: "chennai", to: "coimbatore", km: 507, featured: true },
  { from: "chennai", to: "trichy", km: 332 },
  { from: "chennai", to: "tiruvannamalai", km: 195 },
  { from: "chennai", to: "kanchipuram", km: 72 },
  { from: "chennai", to: "salem", km: 340 },
  { from: "chennai", to: "thanjavur", km: 350 },
  { from: "coimbatore", to: "ooty", km: 86, featured: true },
  { from: "coimbatore", to: "bengaluru", km: 365 },
  { from: "coimbatore", to: "madurai", km: 213 },
  { from: "coimbatore", to: "kodaikanal", km: 170 },
  { from: "madurai", to: "rameswaram", km: 174, featured: true },
  { from: "madurai", to: "kanyakumari", km: 245 },
  { from: "madurai", to: "kodaikanal", km: 120 },
  { from: "trichy", to: "thanjavur", km: 60 },
  { from: "bengaluru", to: "mysuru", km: 145 },
  { from: "bengaluru", to: "ooty", km: 270 },
  { from: "salem", to: "bengaluru", km: 205 },
  { from: "chennai", to: "mahabalipuram", km: 58 },
  { from: "chennai", to: "velankanni", km: 350 },
  { from: "chennai", to: "chidambaram", km: 230 },
  { from: "chennai", to: "yelagiri", km: 228 },
  { from: "chennai", to: "kumbakonam", km: 285 },
  { from: "chennai", to: "tirunelveli", km: 620 },
  { from: "coimbatore", to: "valparai", km: 103 },
  { from: "coimbatore", to: "palani", km: 105 },
  { from: "coimbatore", to: "coonoor", km: 68 },
  { from: "madurai", to: "palani", km: 116 },
  { from: "madurai", to: "tiruchendur", km: 175 },
  { from: "madurai", to: "courtallam", km: 160 },
  { from: "madurai", to: "trichy", km: 135 },
  { from: "trichy", to: "velankanni", km: 146 },
  { from: "salem", to: "yercaud", km: 30 },
  { from: "bengaluru", to: "hosur", km: 40 },
  { from: "bengaluru", to: "yelagiri", km: 160 },
  { from: "tirunelveli", to: "kanyakumari", km: 85 },
];
