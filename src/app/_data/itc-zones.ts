// Pure data for the Oman ITC-zones map and the Pro-Mode closing tools.
// Source of truth: supabase/migrations/0007_projects_seed.up.sql — the 20 signed
// master plans. No I/O, no deps: just the catalogue plus map-ready coordinates,
// factual blurbs and closing talking points.
//
// Hard eligibility rule (drives the residency story):
//   ITC            → all_nationalities  → foreign investors OK; Golden/Investor
//                                          Residency pathway is valid.
//   future_cities  → gcc_omani_only     → Omani/GCC only; NEVER pitch foreign
//   surooh         → gcc_omani_only        ownership or residency to non-GCC.
//
// Coordinates are approximate public locations in Oman, nudged per project so map
// pins in the same area do not overlap. No prices or fabricated figures anywhere.

export interface ItcZoneProject {
  name: string;
  developer: string;
  location: string;
  category: "ITC" | "future_cities" | "surooh";
  ownershipEligibility: "all_nationalities" | "gcc_omani_only";
  ministry: string;
  brandedResidence?: string;
  lat: number;
  lng: number;
  blurb: string;
  talkingPoints: string[];
}

export const ITC_PROJECTS: ItcZoneProject[] = [
  // ITC — all nationalities (Ministry of Heritage and Tourism) ----------------
  {
    name: "Jebel Sifah / Hawana Salalah",
    developer: "Muriya",
    location: "Sifah / Salalah",
    category: "ITC",
    ownershipEligibility: "all_nationalities",
    ministry: "Ministry of Heritage and Tourism",
    lat: 23.421,
    lng: 58.881,
    blurb:
      "Muriya's twin ITC resort destinations — the Jebel Sifah marina-and-golf community southeast of Muscat and the Hawana Salalah beachfront lagoon town in Dhofar — both freehold and open to all nationalities.",
    talkingPoints: [
      "ITC freehold open to buyers of every nationality, with the foreign-owner Golden/Investor Residency pathway available on qualifying purchases.",
      "Two lifestyles under one established developer: a Muscat-coast marina and golf address at Sifah, or monsoon-season beachfront living at Hawana Salalah.",
      "Delivered, operating resort communities with hotels and marinas — a rental-pool and holiday-let angle for investors.",
    ],
  },
  {
    name: "Al Mouj Muscat",
    developer: "Al Mouj Muscat (MAF)",
    location: "Seeb",
    category: "ITC",
    ownershipEligibility: "all_nationalities",
    ministry: "Ministry of Heritage and Tourism",
    brandedResidence: "St. Regis",
    lat: 23.612,
    lng: 58.268,
    blurb:
      "Oman's flagship integrated waterfront community on the Seeb coast, built around a marina, an 18-hole Greg Norman golf course and a beachfront promenade, with St. Regis branded residences.",
    talkingPoints: [
      "ITC freehold open to all nationalities — the anchor address for foreign investors and the Golden/Investor Residency story.",
      "St. Regis branded residences bring hotel-managed service and a globally recognised brand premium.",
      "The most established and liquid ITC community in Muscat, with a deep resale and rental market that supports investor exit.",
    ],
  },
  {
    name: "AIDA",
    developer: "Dar Global (with OMRAN)",
    location: "Yiti",
    category: "ITC",
    ownershipEligibility: "all_nationalities",
    ministry: "Ministry of Heritage and Tourism",
    brandedResidence: "Trump / Marriott / Nickelodeon / Fendi Casa",
    lat: 23.5115,
    lng: 58.639,
    blurb:
      "A clifftop resort community rising above the Sea of Oman at Yiti, anchored by the Trump International Golf Club Oman and Trump-branded residences, with Marriott, Nickelodeon and Fendi Casa partners.",
    talkingPoints: [
      "ITC freehold open to all nationalities — a flagship branded destination for foreign investors seeking Golden/Investor Residency eligibility.",
      "A stack of global brands (Trump, Marriott, Nickelodeon, Fendi Casa) gives strong marketing pull and a branded-residence premium.",
      "Elevated clifftop setting and golf frontage differentiate it from Muscat's flat-waterfront stock.",
    ],
  },
  {
    name: "The Sustainable City — Yiti",
    developer: "Diamond Developers",
    location: "Yiti",
    category: "ITC",
    ownershipEligibility: "all_nationalities",
    ministry: "Ministry of Heritage and Tourism",
    lat: 23.506,
    lng: 58.647,
    blurb:
      "A net-zero-oriented sustainable community at Yiti modelled on Diamond Developers' Dubai original, with solar power, car-reduced clusters and a landscaped green spine.",
    talkingPoints: [
      "ITC freehold open to all nationalities, with the foreign-owner Golden/Investor Residency pathway on qualifying purchases.",
      "Sustainability angle — solar, low running costs, green mobility — appeals to ESG-minded and end-user buyers.",
      "A proven sustainable-city concept transplanted from Dubai; it competes on lifestyle rather than beachfront.",
    ],
  },
  {
    name: "Muscat Bay",
    developer: "Saraya Bandar Jissah",
    location: "Bandar Jissah",
    category: "ITC",
    ownershipEligibility: "all_nationalities",
    ministry: "Ministry of Heritage and Tourism",
    lat: 23.521,
    lng: 58.751,
    blurb:
      "A boutique resort community set between the Hajar mountains and the sea at Bandar Jissah near Muscat, with private beaches, a marina and a Jumeirah hotel.",
    talkingPoints: [
      "ITC freehold open to all nationalities and the Golden/Investor Residency pathway for foreign buyers.",
      "A secluded mountains-meet-sea setting with hotel-serviced amenities that suits lifestyle and second-home buyers.",
      "Close to central Muscat while feeling private and resort-like.",
    ],
  },
  {
    name: "Opal",
    developer: "Alnama",
    location: "Muscat Hills",
    category: "ITC",
    ownershipEligibility: "all_nationalities",
    ministry: "Ministry of Heritage and Tourism",
    lat: 23.5825,
    lng: 58.421,
    blurb:
      "A residential community within the established Muscat Hills golf district, inland of Muscat and close to the international airport.",
    talkingPoints: [
      "ITC freehold open to all nationalities, with the Golden/Investor Residency pathway on qualifying purchases.",
      "Muscat Hills is a settled, green golf-course neighbourhood with schools and amenities nearby — strong for end users and tenants.",
      "Airport-adjacent location favours frequent flyers and the long-term rental market.",
    ],
  },
  {
    name: "Golf Hills / The Pearl",
    developer: "Alosool",
    location: "Muscat Hills",
    category: "ITC",
    ownershipEligibility: "all_nationalities",
    ministry: "Ministry of Heritage and Tourism",
    lat: 23.577,
    lng: 58.426,
    blurb:
      "A golf-fronted residential development in the Muscat Hills community inland of Muscat, beside the Muscat Hills Golf & Country Club.",
    talkingPoints: [
      "ITC freehold open to all nationalities and eligible for the foreign-owner Golden/Investor Residency pathway.",
      "Golf-course frontage and an established community setting appeal to end users and long-stay tenants.",
      "Inland Muscat Hills offers a quieter, greener alternative to the waterfront ITCs.",
    ],
  },
  {
    name: "Vistal",
    developer: "Leo Development",
    location: "Al Mouj",
    category: "ITC",
    ownershipEligibility: "all_nationalities",
    ministry: "Ministry of Heritage and Tourism",
    brandedResidence: "Victoria Swarovski",
    lat: 23.608,
    lng: 58.274,
    blurb:
      "A waterfront residential development inside Al Mouj Muscat featuring Victoria Swarovski branded residences.",
    talkingPoints: [
      "ITC freehold open to all nationalities within Al Mouj — full access to the Golden/Investor Residency pathway for foreign buyers.",
      "Victoria Swarovski branded interiors add a design-led premium and a distinct marketing story.",
      "Sits inside Oman's most liquid ITC, sharing Al Mouj's marina, golf and beachfront amenities.",
    ],
  },
  {
    name: "Bellevue",
    developer: "Ideal Buildings",
    location: "Al Mouj",
    category: "ITC",
    ownershipEligibility: "all_nationalities",
    ministry: "Ministry of Heritage and Tourism",
    lat: 23.6155,
    lng: 58.2635,
    blurb:
      "A residential development within Al Mouj Muscat, Oman's flagship waterfront ITC on the Seeb coast.",
    talkingPoints: [
      "ITC freehold open to all nationalities, with the Golden/Investor Residency pathway for foreign buyers.",
      "Located inside Al Mouj, it shares the community's marina, golf, beach and retail promenade.",
      "Al Mouj's depth of resale and rental demand supports investor exit and yield.",
    ],
  },
  {
    name: "Residences at Mandarin Oriental",
    developer: "Eagle Hills",
    location: "Shatti Al Qurum",
    category: "ITC",
    ownershipEligibility: "all_nationalities",
    ministry: "Ministry of Heritage and Tourism",
    brandedResidence: "Mandarin Oriental",
    lat: 23.6115,
    lng: 58.489,
    blurb:
      "Mandarin Oriental branded residences by Eagle Hills at Shatti Al Qurum, Muscat's prime beachfront district.",
    talkingPoints: [
      "ITC freehold open to all nationalities and the Golden/Investor Residency pathway for foreign buyers.",
      "Mandarin Oriental branding brings hotel-managed service and a top-tier branded-residence premium.",
      "Shatti Al Qurum is Muscat's most prestigious beachfront address, close to the city's diplomatic and retail core.",
    ],
  },
  {
    name: "Yamal",
    developer: "Talaat Mostafa Group (with Al Muhaidib)",
    location: "Al Manuma, Seeb",
    category: "ITC",
    ownershipEligibility: "all_nationalities",
    ministry: "Ministry of Heritage and Tourism",
    lat: 23.59,
    lng: 58.24,
    blurb:
      "A large master-planned community at Al Manuma in Seeb by Egypt's Talaat Mostafa Group with Al Muhaidib; catalogued as ITC while its final classification is being confirmed.",
    talkingPoints: [
      "Listed as ITC (all nationalities), but confirm the final ITC-vs-Housing classification before pitching foreign ownership or the residency story.",
      "Backed by a major regional master-developer (Talaat Mostafa) known for large integrated cities.",
      "Al Manuma / Seeb places it in Muscat's fast-growing western growth corridor.",
    ],
  },
  // Future Cities — Omani/GCC only, Sultan Haitham City (MoHUP) ---------------
  {
    name: "Wadi Zaha",
    developer: "Al Ahly Sabbour",
    location: "Sultan Haitham City",
    category: "future_cities",
    ownershipEligibility: "gcc_omani_only",
    ministry: "Ministry of Housing and Urban Planning",
    lat: 23.5525,
    lng: 58.182,
    blurb:
      "A residential neighbourhood within Sultan Haitham City, MoHUP's flagship new planned city southwest of Seeb, developed by Egypt's Al Ahly Sabbour.",
    talkingPoints: [
      "Future Cities: ownership is reserved for Omani and GCC nationals — do NOT pitch foreign ownership or the Golden/Investor Residency story.",
      "Part of a government-backed master-planned city designed around smart-city and sustainability principles.",
      "Target Omani and GCC end users and families seeking a modern planned community near Muscat.",
    ],
  },
  {
    name: "Sarooj Oasis",
    developer: "Sarooj Development",
    location: "Sultan Haitham City",
    category: "future_cities",
    ownershipEligibility: "gcc_omani_only",
    ministry: "Ministry of Housing and Urban Planning",
    lat: 23.548,
    lng: 58.1755,
    blurb:
      "A residential neighbourhood inside Sultan Haitham City near Seeb, developed by Sarooj Development.",
    talkingPoints: [
      "Future Cities: Omani and GCC buyers only — no foreign-ownership or residency pitch.",
      "Located in Oman's flagship new planned city, with integrated infrastructure and amenities.",
      "Suited to Omani and GCC end users and long-term family buyers.",
    ],
  },
  {
    name: "Hay Al Wafa",
    developer: "Al Abrar",
    location: "Sultan Haitham City",
    category: "future_cities",
    ownershipEligibility: "gcc_omani_only",
    ministry: "Ministry of Housing and Urban Planning",
    lat: 23.556,
    lng: 58.188,
    blurb:
      "A residential neighbourhood (hay) within Sultan Haitham City near Seeb, developed by Al Abrar.",
    talkingPoints: [
      "Future Cities: eligibility limited to Omani and GCC nationals — no foreign-ownership or residency angle.",
      "Part of MoHUP's master-planned smart city built for a large resident population.",
      "Position to Omani and GCC family end users.",
    ],
  },
  {
    name: "Yenaier Residences / Hay Al We'am",
    developer: "Adrak / Adanté",
    location: "Sultan Haitham City",
    category: "future_cities",
    ownershipEligibility: "gcc_omani_only",
    ministry: "Ministry of Housing and Urban Planning",
    lat: 23.5445,
    lng: 58.192,
    blurb:
      "A residential neighbourhood within Sultan Haitham City near Seeb, developed by Adrak / Adanté.",
    talkingPoints: [
      "Future Cities: Omani and GCC nationals only — do NOT pitch foreign ownership or residency.",
      "Sits inside Oman's flagship new city with modern master-planned infrastructure.",
      "Aimed at Omani and GCC end users and families.",
    ],
  },
  {
    name: "Jood",
    developer: "Talaat Mostafa Group (with Al Muhaidib)",
    location: "Sultan Haitham City",
    category: "future_cities",
    ownershipEligibility: "gcc_omani_only",
    ministry: "Ministry of Housing and Urban Planning",
    lat: 23.56,
    lng: 58.1695,
    blurb:
      "A residential community within Sultan Haitham City near Seeb, developed by Talaat Mostafa Group with Al Muhaidib.",
    talkingPoints: [
      "Future Cities: reserved for Omani and GCC buyers — no foreign-ownership or residency story.",
      "Delivered by a major regional master-developer inside a government flagship city.",
      "Target Omani and GCC end users seeking scale and amenities.",
    ],
  },
  {
    name: "Hay Al Ahlam",
    developer: "Dream Villa",
    location: "Sultan Haitham City",
    category: "future_cities",
    ownershipEligibility: "gcc_omani_only",
    ministry: "Ministry of Housing and Urban Planning",
    lat: 23.5505,
    lng: 58.1955,
    blurb:
      "A residential neighbourhood within Sultan Haitham City near Seeb, developed by Dream Villa.",
    talkingPoints: [
      "Future Cities: Omani and GCC nationals only — no foreign-ownership or residency pitch.",
      "Part of Oman's flagship master-planned smart city.",
      "Suited to Omani and GCC family end users.",
    ],
  },
  {
    name: "Hay Al Nuha",
    developer: "Tibian",
    location: "Sultan Haitham City",
    category: "future_cities",
    ownershipEligibility: "gcc_omani_only",
    ministry: "Ministry of Housing and Urban Planning",
    lat: 23.543,
    lng: 58.1685,
    blurb:
      "A residential neighbourhood within Sultan Haitham City near Seeb, developed by Tibian.",
    talkingPoints: [
      "Future Cities: eligibility limited to Omani and GCC nationals — no foreign-ownership or residency angle.",
      "Located inside MoHUP's flagship planned city with integrated services.",
      "Aim at Omani and GCC end users and families.",
    ],
  },
  // Surooh — Omani/GCC only (MoHUP) ------------------------------------------
  {
    name: "Hay Al Naseem",
    developer: "Adrak / Adanté",
    location: "Barka",
    category: "surooh",
    ownershipEligibility: "gcc_omani_only",
    ministry: "Ministry of Housing and Urban Planning",
    lat: 23.702,
    lng: 57.888,
    blurb:
      "A Surooh integrated residential neighbourhood in the coastal Batinah town of Barka, west of Muscat, developed by Adrak / Adanté.",
    talkingPoints: [
      "Surooh: ownership is reserved for Omani and GCC nationals — do NOT pitch foreign ownership or the residency story.",
      "Part of MoHUP's Surooh programme of integrated neighbourhoods with community amenities.",
      "Barka's coastal commuter belt suits Omani and GCC end users who want to stay near Muscat.",
    ],
  },
  {
    name: "Hay Al Majd",
    developer: "Almajd Real Estate",
    location: "Sohar",
    category: "surooh",
    ownershipEligibility: "gcc_omani_only",
    ministry: "Ministry of Housing and Urban Planning",
    lat: 24.341,
    lng: 56.7075,
    blurb:
      "A Surooh integrated residential neighbourhood in the northern Batinah port city of Sohar, developed by Almajd Real Estate.",
    talkingPoints: [
      "Surooh: Omani and GCC nationals only — no foreign-ownership or residency pitch.",
      "Part of MoHUP's Surooh programme of planned neighbourhoods with integrated amenities.",
      "Sohar's industrial-port economy supports local Omani and GCC end-user demand.",
    ],
  },
];

export interface ItcZone {
  name: string;
  lat: number;
  lng: number;
  summary: string;
}

// Area groupings for the map — one pin per zone with an eligibility-aware summary.
export const ITC_ZONES: ItcZone[] = [
  {
    name: "Al Mouj",
    lat: 23.61,
    lng: 58.27,
    summary:
      "Oman's flagship ITC waterfront in Seeb — marina, Greg Norman golf and beachfront living; freehold and open to all nationalities.",
  },
  {
    name: "Yiti",
    lat: 23.51,
    lng: 58.64,
    summary:
      "Clifftop and eco-focused ITC district east of Muscat, home to landmark branded and sustainable communities; freehold for all nationalities.",
  },
  {
    name: "Bandar Jissah",
    lat: 23.52,
    lng: 58.75,
    summary:
      "Secluded mountains-meet-sea ITC cove south of Muscat with resort-branded residences; freehold for all nationalities.",
  },
  {
    name: "Jebel Sifah",
    lat: 23.42,
    lng: 58.88,
    summary:
      "Marina-and-golf ITC resort town on the Gulf of Oman coast southeast of Muscat; freehold for all nationalities.",
  },
  {
    name: "Muscat Hills",
    lat: 23.58,
    lng: 58.42,
    summary:
      "Established inland ITC golf community near the airport; freehold for all nationalities.",
  },
  {
    name: "Shatti Al Qurum",
    lat: 23.61,
    lng: 58.49,
    summary:
      "Muscat's prime beachfront address, home to ultra-luxury branded ITC residences; freehold for all nationalities.",
  },
  {
    name: "Sultan Haitham City",
    lat: 23.55,
    lng: 58.18,
    summary:
      "MoHUP's flagship new planned city southwest of Seeb — Future Cities neighbourhoods reserved for Omani and GCC buyers only.",
  },
  {
    name: "Barka",
    lat: 23.7,
    lng: 57.89,
    summary:
      "Coastal Batinah town west of Muscat hosting Surooh integrated neighbourhoods for Omani and GCC buyers only.",
  },
  {
    name: "Sohar",
    lat: 24.34,
    lng: 56.71,
    summary:
      "Northern Batinah industrial-port city hosting Surooh integrated neighbourhoods for Omani and GCC buyers only.",
  },
  {
    name: "Salalah",
    lat: 17.02,
    lng: 54.09,
    summary:
      "Dhofar's monsoon-season coastal resort city, home to Hawana Salalah ITC marina and lagoon living; freehold for all nationalities.",
  },
];
