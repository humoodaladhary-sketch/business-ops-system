// Consolidated REAL data pulled from the team's Google Drive CRM sheets
// (Shatha, Alex, Pasha, Wesam deals + Yousef head-of-sales override sheet, and
// agent lead pipelines). This is the baked snapshot; the GoogleSheetsAdapter
// keeps it in sync continuously once a service account is configured.
//
// Comp model is date-aware: deals before COMP_NEW_EFFECTIVE use the LEGACY
// recorded split (25% advisor / 35% senior / 50% own-referral + head-of-sales
// override); from July 2026 the performance ladder engine takes over.

export const COMP_NEW_EFFECTIVE = "2026-07"; // performance ladder activates here
export const DASHBOARD_PERIOD = "2026-02"; // most-populated month for the live views

const DRIVE = (id: string) => `https://drive.google.com/drive/folders/${id}`;

export type DevPaid = "RECEIVED" | "NOT_RECEIVED" | "PENDING";
export type AgentPaid = "PAID" | "NOT_PAID";
export type SourceTag = "ALWALAA" | "REFERRAL" | "OWN";

export interface AgentRecord {
  id: string;
  name: string;
  role: "SENIOR" | "ADVISOR" | "NEW" | "TRAINEE" | "HEAD_OF_SALES" | "MARKETING" | "FINANCE" | "CEO";
  segment: "DIASPORA" | "RESIDENT" | "NA";
  target: number; // monthly OMR; 0 = no hard target
  driveFolder?: string;
  closedDocs?: string;
  vouchers?: string;
  rampEndDate?: string;
  exempt?: boolean;
  status?: "ACTIVE" | "FORMER"; // FORMER = kept for records/insight only
}

export interface DealRecord {
  id: string;
  agentId: string;
  client: string;
  developer: string;
  project: string;
  unitType: string;
  unitNumber: string;
  value: number;
  devRatePct: number; // developer -> Alwalaa, percent
  gross: number; // alwalaa gross (recorded)
  splitPct: number; // recorded agent split percent (legacy)
  payout: number; // recorded agent payout (legacy)
  source: SourceTag;
  devPaid: DevPaid;
  agentPaid: AgentPaid;
  closeDate: string | null; // YYYY-MM-DD
  period: string; // YYYY-MM (drives the month)
  stage: "CLOSED_WON" | "RESERVATION";
  pv?: string; // payment voucher no.
  overridePct?: number; // head-of-sales override (legacy)
  overrideAmount?: number;
}

export interface LeadRecord {
  id: string;
  agentId: string | null;
  title: string;
  name: string;
  phoneRaw: string;
  email: string | null;
  country: string | null;
  nationality: string | null;
  language: string | null;
  budget: string | null;
  purpose: string | null;
  projectInterest: string | null;
  source: SourceTag;
  rawStage: string;
  stage: string; // canonical
  dealStatus: string | null;
  registeredOn: string | null;
  lastFollowUp: string | null;
  notes: string | null;
}

export const AGENTS: AgentRecord[] = [
  { id: "shatha", name: "Shatha Al Manthari", role: "SENIOR", segment: "DIASPORA", target: 350000, driveFolder: DRIVE("1-r9HPvaiH-LDbd3Rv6m_Sp_PiPDvaTJB"), closedDocs: DRIVE("1vUhUiZygkAGtVwN_-10QP_tlOJs-Cey2"), vouchers: DRIVE("1g7OSUcaOoq3SiOt2NuvRO05TD0Gy5fkN") },
  { id: "yousef", name: "Yousef", role: "HEAD_OF_SALES", segment: "NA", target: 0, status: "FORMER", driveFolder: DRIVE("10Fr22TuuAXL6kj3Wa3vYPj_hA3dtVqXr"), closedDocs: DRIVE("1qvuv5qbiRMZBXM_A_H3g4Pszo4kGenwN"), vouchers: DRIVE("1J8ZM4_zrGDviuZdvD_2gubTmFOQnRlwZ") },
  { id: "alex", name: "Alex Showran", role: "ADVISOR", segment: "RESIDENT", target: 250000, driveFolder: DRIVE("1BJMCIFLLcqqhv4IpaJxovcgiGHeIBlJU"), closedDocs: DRIVE("1-XxmHUPyhzEGY5yfJ7t93H7-85NEkH_6"), vouchers: DRIVE("1MoLzIKfHdJ54E-qyyxwKaGWoAsvzOuit") },
  { id: "pasha", name: "Pasha", role: "ADVISOR", segment: "RESIDENT", target: 250000, driveFolder: DRIVE("1zBD-0lDQxZgwt0m74aNOgk16A8AyA6S9"), closedDocs: DRIVE("1GlZNvJ15TVhicjlQAzSlueVzHoFxFo1a"), vouchers: DRIVE("1_RXKortsifhp3GJRB5TCZMxD7mSjJMNJ") },
  { id: "wesam", name: "Wesam Zeno", role: "ADVISOR", segment: "RESIDENT", target: 250000, driveFolder: DRIVE("18jh5WBpXifLf-5bxPdqRZQxHQW5FCDoB"), closedDocs: DRIVE("1Hort5_HjU6jrhUkWMS7qvE6dvBsyPaqj"), vouchers: DRIVE("14j4h7-9EU0Akbr9FGluwi377kmKEGv26") },
  { id: "khalid", name: "Khalid", role: "NEW", segment: "RESIDENT", target: 120000, rampEndDate: "2026-09-01" },
  { id: "tariq", name: "Tariq", role: "TRAINEE", segment: "NA", target: 0, exempt: true, driveFolder: DRIVE("1ZxXvWfcyFh7vE-jLAJ83s-u-Ac9khtcz") },
  { id: "abeer", name: "Abeer Al Wardi", role: "MARKETING", segment: "NA", target: 0, driveFolder: DRIVE("1QlDo9hkF8WY2t8_xUHiZ2axf8v7K8P4C") },
];

// Helper to keep the deal list compact.
function d(
  id: string, agentId: string, client: string, developer: string, project: string,
  unit: [string, string], value: number, devRatePct: number, gross: number,
  splitPct: number, payout: number, source: SourceTag, devPaid: DevPaid, agentPaid: AgentPaid,
  closeDate: string | null, period: string, stage: DealRecord["stage"], pv?: string,
): DealRecord {
  return { id, agentId, client, developer, project, unitType: unit[0], unitNumber: unit[1], value, devRatePct, gross, splitPct, payout, source, devPaid, agentPaid, closeDate, period, stage, pv };
}

export const DEALS: DealRecord[] = [
  // --- Shatha (senior) ---
  d("sh1", "shatha", "Mohammad Edris Karim", "Ahly Sabbour", "Wadi Zaha", ["Studio", "E26-D512"], 43500, 3.5, 1522.5, 35, 532.88, "ALWALAA", "RECEIVED", "PAID", "2025-10-30", "2025-10", "CLOSED_WON", "PV-2026-0003"),
  d("sh2", "shatha", "Christina & Andreas", "Ahly Sabbour", "Wadi Zaha", ["2BD Penthouse", "E26-D605"], 139131.72, 3.5, 4869.61, 35, 1704.36, "ALWALAA", "RECEIVED", "PAID", "2026-01-05", "2026-01", "CLOSED_WON", "PV-2026-0003"),
  d("sh3", "shatha", "Sukhwinder Singh", "Ahly Sabbour", "Wadi Zaha", ["Studio", "E26-D402"], 42750.48, 3.5, 1496.27, 50, 748.14, "REFERRAL", "RECEIVED", "PAID", "2026-01-07", "2026-01", "CLOSED_WON"),
  d("sh4", "shatha", "Muhammad N. Momen", "Sarooj Development", "Sarooj Oasis", ["1BHK", "B1-409"], 62914.5, 4, 2516.58, 35, 880.8, "ALWALAA", "RECEIVED", "PAID", "2026-02-09", "2026-02", "CLOSED_WON", "PV-2026-0007"),
  d("sh5", "shatha", "Mohammed Asaduzzaman", "Sarooj Development", "Sarooj Oasis", ["1BHK", "B1-107"], 50150, 4, 2006, 35, 702.1, "ALWALAA", "RECEIVED", "PAID", "2026-02-09", "2026-02", "CLOSED_WON", "PV-2026-00011"),
  d("sh6", "shatha", "Mohamood Entezar", "Sarooj Development", "Sarooj Oasis", ["Penthouse 3BHK", "B1-501"], 173920, 4, 6956.8, 35, 2434.88, "ALWALAA", "RECEIVED", "PAID", "2026-02-25", "2026-02", "CLOSED_WON", "PV-2026-0007"),
  d("sh7", "shatha", "Mohamood Entezar", "Sarooj Development", "Sarooj Oasis", ["2BHK", "B3-401"], 92650, 4, 3706, 35, 1297.1, "ALWALAA", "RECEIVED", "PAID", "2026-02-25", "2026-02", "CLOSED_WON", "PV-2026-0007"),
  d("sh8", "shatha", "Mhasood Entezar", "Sarooj Development", "Sarooj Oasis", ["1BHK", "B3-409"], 56100, 4, 2244, 35, 785.4, "ALWALAA", "RECEIVED", "PAID", "2026-02-25", "2026-02", "CLOSED_WON"),
  d("sh9", "shatha", "Alan Ang", "Sarooj Development", "Sarooj Oasis", ["1BHK", "B3-410"], 56100, 4, 2244, 35, 785.4, "ALWALAA", "RECEIVED", "PAID", "2026-02-25", "2026-02", "CLOSED_WON"),
  d("sh10", "shatha", "Nahida Karim", "Sarooj Development", "Sarooj Oasis", ["1BHK", "B3-406"], 54450, 4, 2178, 35, 762.3, "ALWALAA", "RECEIVED", "PAID", "2026-02-26", "2026-02", "CLOSED_WON", "PV-2026-00011"),
  d("sh11", "shatha", "Nahida Karim", "Ahly Sabbour", "Wadi Zaha", ["3BD Penthouse", "E27-B604"], 143715, 3.5, 5030.03, 35, 1760.51, "ALWALAA", "NOT_RECEIVED", "NOT_PAID", "2026-02-13", "2026-02", "CLOSED_WON"),
  d("sh12", "shatha", "Helen Lauren & Peep Nork", "Muriya", "Olive Farms", ["2BD", "OL-204"], 99000, 3, 2970, 35, 1039.5, "ALWALAA", "NOT_RECEIVED", "NOT_PAID", "2026-01-29", "2026-01", "CLOSED_WON"),
  d("sh13", "shatha", "M. Muzahidul Islam", "Sarooj Development", "Sarooj Oasis", ["1BHK", "B3-303"], 52470, 4, 2098.8, 35, 734.58, "ALWALAA", "RECEIVED", "PAID", "2026-03-02", "2026-03", "CLOSED_WON", "PV-2026-00011"),
  d("sh14", "shatha", "Volkmar Mannl", "Ahly Sabbour", "Wadi Zaha", ["2BD Penthouse", "E26-C602"], 147000, 3.5, 5145, 35, 1800.75, "ALWALAA", "NOT_RECEIVED", "NOT_PAID", "2026-03-26", "2026-03", "CLOSED_WON"),
  d("sh15", "shatha", "Mansoor Khan", "Adante Realty", "Yenaire", ["Retail", "96.GF.RT.01"], 93348, 3, 2800.44, 35, 980.15, "ALWALAA", "NOT_RECEIVED", "NOT_PAID", "2026-05-02", "2026-05", "CLOSED_WON"),

  // --- Alex (advisor) ---
  d("ax1", "alex", "Rasul Maideen", "Adante Realty", "Yenaire", ["1BHK", "100.L1.06"], 62502, 3, 1875.06, 25, 468.77, "ALWALAA", "RECEIVED", "PAID", "2025-12-18", "2025-12", "CLOSED_WON"),
  d("ax2", "alex", "Salahudin", "Ahly Sabbour", "Wadi Zaha", ["2BHK", "E26-C113"], 77000, 3.5, 2695, 25, 641.67, "ALWALAA", "RECEIVED", "PAID", "2026-02-15", "2026-02", "CLOSED_WON"),
  d("ax3", "alex", "Zia Ul Haq", "Ahly Sabbour", "Wadi Zaha", ["1BHK", "E26-B302"], 63200, 3.5, 2212, 25, 526.67, "ALWALAA", "RECEIVED", "PAID", "2026-02-04", "2026-02", "CLOSED_WON", "PV-2026-0007"),
  d("ax4", "alex", "Mohd. Ayaz", "Sarooj Development", "Sarooj Oasis", ["1BHK", "B1-309"], 61346.25, 4, 2453.85, 25, 613.46, "ALWALAA", "RECEIVED", "PAID", "2026-02-17", "2026-02", "CLOSED_WON", "PV-2026-00011"),
  d("ax5", "alex", "Dana", "Ahly Sabbour", "Wadi Zaha", ["Studio", "E26-D508"], 53833.33, 3.5, 1884.17, 25, 471.04, "ALWALAA", "RECEIVED", "PAID", "2026-04-16", "2026-04", "CLOSED_WON"),

  // --- Pasha (advisor) ---
  d("pa1", "pasha", "Nadim ul Atik", "Ahly Sabbour", "Wadi Zaha", ["Apartment", "B302"], 78181.8, 3.5, 2736.36, 50, 1368.18, "REFERRAL", "NOT_RECEIVED", "NOT_PAID", "2026-04-22", "2026-04", "CLOSED_WON"),
  d("pa2", "pasha", "Asif Ali Sheikh", "Adante Realty", "Yenaire", ["Studio", "SD05-L7"], 50104, 3, 1503.12, 25, 375.78, "ALWALAA", "NOT_RECEIVED", "NOT_PAID", "2026-05-02", "2026-05", "CLOSED_WON"),
  d("pa3", "pasha", "Dr. Ashfaq Khan", "Adante Realty", "Yenaire", ["Apartment", "L1-09"], 80801, 3, 2424.03, 25, 606.01, "ALWALAA", "NOT_RECEIVED", "NOT_PAID", "2026-04-14", "2026-04", "CLOSED_WON"),
  d("pa4", "pasha", "Mohammed Naji", "Adante Realty", "Yenaire", ["Studio", "101.L2.01"], 63944, 3, 1918.32, 25, 479.58, "ALWALAA", "NOT_RECEIVED", "NOT_PAID", "2026-05-11", "2026-05", "CLOSED_WON"),
  d("pa5", "pasha", "Ms Bano", "Ahly Sabbour", "Wadi Zaha", ["1BHK", "E22-102"], 73400, 3.5, 2569, 35, 899.15, "ALWALAA", "NOT_RECEIVED", "NOT_PAID", null, "2026-05", "RESERVATION"),
  d("pa6", "pasha", "Mr Nawaz", "Ahly Sabbour", "Wadi Zaha", ["Retail 98sqm", "E27-B-R2"], 93553, 3.5, 3274.36, 35, 1146.03, "ALWALAA", "NOT_RECEIVED", "NOT_PAID", null, "2026-05", "RESERVATION"),

  // --- Wesam (advisor) ---
  d("we1", "wesam", "Ahmed Sahraoui", "Al Abrar", "Hay Al Wafaa", ["2BHK", "59-D-203"], 81950, 3, 2458.5, 25, 614.63, "ALWALAA", "RECEIVED", "PAID", "2026-01-29", "2026-01", "CLOSED_WON", "PV-2026-0007"),
  d("we2", "wesam", "Alyaa Jasim Al Tameemi", "Al Abrar", "Hay Al Wafaa", ["Townhouse A", "10-22-4"], 116495, 3, 3494.85, 25, 873.71, "ALWALAA", "RECEIVED", "PAID", "2026-01-20", "2026-01", "CLOSED_WON", "PV-2026-0007"),
  d("we3", "wesam", "Alaa Alhakim", "Sarooj Development", "Sarooj Oasis", ["1BHK", "B2-002"], 51415, 4, 2056.6, 25, 514.15, "ALWALAA", "RECEIVED", "PAID", "2026-02-05", "2026-02", "CLOSED_WON", "PV-2026-00011"),
  d("we4", "wesam", "Lucia Semsakova", "Ahly Sabbour", "Wadi Zaha", ["Studio", "E26-D302"], 42250.48, 3.5, 1478.77, 25, 369.69, "ALWALAA", "RECEIVED", "PAID", "2026-01-28", "2026-01", "CLOSED_WON", "PV-2026-0007"),
];

// Curated real leads with full contact detail (country code derived from phone).
function L(
  id: string, agentId: string | null, title: string, name: string, phoneRaw: string,
  email: string | null, country: string | null, nationality: string | null,
  budget: string | null, purpose: string | null, projectInterest: string | null,
  source: SourceTag, rawStage: string, stage: string, dealStatus: string | null,
  registeredOn: string | null, lastFollowUp: string | null, notes: string | null,
): LeadRecord {
  return { id, agentId, title, name, phoneRaw, email, country, nationality, budget, purpose, projectInterest, source, rawStage, stage, dealStatus, registeredOn, lastFollowUp, notes, language: null };
}

export const LEADS: LeadRecord[] = [
  L("ld1", "alex", "Mr.", "Jilal Malih", "+44 7958 008313", null, "United Kingdom", "British", "75,000 – 100,000 OMR", "Investment - Rental Income", "Wadi Zaha", "ALWALAA", "Qualification meeting", "ENGAGED", "In Progress", "2026-02-20", "2026-03-02", "Couple + 2 children; SHC focus"),
  L("ld2", "alex", "Dr.", "Ali Imad Fadlallah", "+1 313 610 0000", null, "United States", "Lebanese", "150,000 – 200,000 OMR", "Investment - Rental Income", "Almouj Muscat", "ALWALAA", "Qualification meeting", "ENGAGED", "In Progress", "2026-03-11", "2026-03-12", "Planning to visit Oman"),
  L("ld3", "alex", "Mr.", "Sergei", "+971 50 432 5027", null, "United Arab Emirates", "Russian", "50,000 – 75,000 OMR", "Secondary Home", "Hay Al Wafaa", "ALWALAA", "Contacted", "QUALIFIED", "In Progress", "2026-04-09", "2026-04-12", "Software developer; needs time"),
  L("ld4", "alex", "Mr.", "Mortaza", "+44 7512 277729", null, "United Kingdom", "Bangladeshi", "50,000 – 75,000 OMR", "Investment - Rental Income", "Wadi Zaha", "ALWALAA", "Contacted", "QUALIFIED", "In Progress", "2026-04-12", "2026-04-30", "Visiting 30 Apr with a friend"),
  L("ld5", "alex", "Mrs.", "Mariam", "+965 6671 5055", null, "Kuwait", "Kuwaiti", "50,000 – 75,000 OMR", "Primary Residence", "Wadi Zaha", "ALWALAA", "Contacted", "QUALIFIED", "In Progress", "2026-04-18", "2026-04-25", "Waiting for the airport to open"),
  L("ld6", "alex", "Mr.", "Anas", "+960 7942494", null, "Maldives", "Maldivian", "50,000 – 75,000 OMR", "Investment - Rental Income", "Wadi Zaha", "ALWALAA", "Contacted", "QUALIFIED", "In Progress", "2026-05-12", null, "Still exploring; needs another meeting"),
  L("ld7", "alex", "Mr.", "Harish", "+91 95354 14557", null, "India", "Indian", "150,000 – 200,000 OMR", "Investment - Rental Income", "Sultan Haitham City", "ALWALAA", "Contacted", "QUALIFIED", "In Progress", "2026-05-02", null, "Townhouse; still deciding"),
  L("ld8", "alex", "Mr.", "Mohit", "+91 87450 52020", null, "India", "Indian", "200,000 – 300,000 OMR", "Primary Residence", "Sultan Haitham City", "ALWALAA", "Contacted", "QUALIFIED", "In Progress", "2026-05-03", null, "Wants ready-to-move villa"),
  L("ld9", "pasha", "Mr.", "Andreas", "+49 176 44473558", null, "Germany", "German", "50,000 – 75,000 OMR", "Primary Residence", "Sarooj Oasis", "ALWALAA", "Closing stage", "NEGOTIATION", "LOST", "2026-02-16", "2026-04-10", "Needs more time to decide"),
  L("ld10", "pasha", "Mr.", "Dabir", "+91 98201 53254", "dabir3006@gmail.com", "India", "Indian", "Below 50,000 OMR", "Primary Residence", "Yenaire", "ALWALAA", "Qualification meeting", "ENGAGED", "LOST", "2026-02-12", "2026-03-31", "Dropped the plan for now"),
  L("ld11", "pasha", "Mr.", "Ismail", "+968 9467 6229", null, "Oman", "Egyptian", "50,000 – 75,000 OMR", "Primary Residence", "Sarooj Oasis", "ALWALAA", "Qualification meeting", "ENGAGED", "In Progress", "2026-01-23", "2026-04-26", "Awaiting sale of property in Türkiye"),
  L("ld12", "pasha", "Mrs.", "Tahreem", "+48 729 672 740", null, "Poland", "Pakistani", "75,000 – 100,000 OMR", "Primary Residence", "Wadi Zaha", "ALWALAA", "Qualification meeting", "ENGAGED", "In Progress", "2026-02-26", "2026-04-26", "Needs time due to conflict"),
  L("ld13", "pasha", "Mr.", "Hamza", "+91 63070 87381", "itshamzafx1998@gmail.com", "India", "Indian", "500,000 – 1,000,000 OMR", "Primary Residence", "Muscat Bay", "ALWALAA", "Qualification meeting", "ENGAGED", "LOST", "2026-02-23", "2026-03-01", "Not a serious client"),
  L("ld14", "pasha", "Mrs.", "Kamila", "+44 7933 407813", "kamilaqudsiashakeel@gmail.com", "United Kingdom", "British", "150,000 – 200,000 OMR", null, null, "ALWALAA", "Contacted", "QUALIFIED", "LOST", "2026-03-01", "2026-03-08", "Not responding"),
  L("ld15", "wesam", "Mr.", "Marcin", "+48 502 265 192", "santorinirestauracja@gmail.com", "Poland", "Polish", "50,000 – 75,000 OMR", "Investment - Flip / Resale", "Sarooj Oasis", "ALWALAA", "Closing stage", "NEGOTIATION", "LOST", "2025-12-26", "2026-04-28", "Didn't answer"),
  L("ld16", "wesam", "Mr.", "Ibrahim AlKhulaifi", "+966 562 956156", null, "Yemen", "Yemeni", "50,000 – 75,000 OMR", "Primary Residence", "Sarooj Oasis", "ALWALAA", "Closing stage", "RESERVATION", "CLOSED", "2025-10-23", "2026-04-11", "Closed with Yousef"),
  L("ld17", "wesam", "Mr.", "Matthias Weishaar", "+49 176 51135772", null, "Germany", "German", "50,000 – 75,000 OMR", "Investment - Rental Income", "Yenaire", "ALWALAA", "Closing stage", "NEGOTIATION", "LOST", "2025-11-11", "2026-04-17", "Didn't answer"),
  L("ld18", "wesam", "Mr.", "Wicem", "+971 50 334 9661", null, "United Arab Emirates", "Indian", "Below 50,000 OMR", "Investment - Rental Income", "Yenaire", "ALWALAA", "Closing stage", "NEGOTIATION", "LOST", "2025-11-11", "2026-04-17", "Broker in Dubai"),
  L("ld19", "shatha", "Mr.", "Brijesh", "+233 558726", null, "Ghana", "Indian", "150,000 – 200,000 OMR", "Primary Residence", "Wadi Zaha", "ALWALAA", "Contacted", "QUALIFIED", "In Progress", "2026-03-19", null, "3BHK; ready with booking fee; visiting May 1"),
  L("ld20", "shatha", "Mr.", "Abrar Mohammed", "+971 55 407941", null, "United Arab Emirates", null, "50,000 – 75,000 OMR", null, "Jabal Sifah", "ALWALAA", "Qualification meeting", "ENGAGED", null, "2026-03-27", null, "Muriya / Jabal Sifah interest"),
  L("ld21", "shatha", "Dr.", "Elke Grundler", "+49 157 34206854", null, "Germany", null, "150,000 – 200,000 OMR", null, null, "ALWALAA", "Contacted", "QUALIFIED", null, "2026-02-22", "2026-04-03", "Prefers to wait (GCC politics)"),
  L("ld22", "pasha", "Mr.", "Yahia", "+44 7974 176854", null, "United Kingdom", null, null, null, null, "ALWALAA", "Contacted", "QUALIFIED", null, "2026-03-05", null, "Teacher; couple"),
  L("ld23", "alex", "Mr.", "Khozema", "+965 50134483", null, "Kuwait", "Indian", "100,000 – 150,000 OMR", "Primary Residence", "Wadi Zaha", "ALWALAA", "Contacted", "QUALIFIED", "In Progress", "2026-04-26", "2026-04-26", "Townhouse; no proper response"),
  L("ld24", "alex", "Mr.", "Shoeb", "+1 540 556 4723", null, "United States", "Pakistani", "Below 50,000 OMR", "Primary Residence", "Wadi Zaha", "ALWALAA", "Contacted", "QUALIFIED", "In Progress", "2026-05-10", null, "Cannot make the down payment"),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getAgent(id: string): AgentRecord | undefined {
  return AGENTS.find((a) => a.id === id);
}

export function dealsForAgent(id: string): DealRecord[] {
  return DEALS.filter((d) => d.agentId === id);
}

export function leadsForAgent(id: string): LeadRecord[] {
  return LEADS.filter((l) => l.agentId === id);
}

export function isLegacyPeriod(period: string): boolean {
  return period < COMP_NEW_EFFECTIVE;
}
