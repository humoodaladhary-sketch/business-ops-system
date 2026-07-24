// Lead-routing engine with the "10-minute basket" rule: an assigned lead sits
// in an agent's basket for CLAIM_WINDOW; if not accepted in time it auto-routes
// to the next agent (round-robin). In-memory here for live interaction in dev;
// production persists to the Lead/Assignment tables and sweeps via a Supabase
// cron (see /api/portal/sweep).

export const CLAIM_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export type AssignStatus = "UNCLAIMED" | "ASSIGNED" | "CLAIMED";

export interface Assignment {
  leadId: string;
  name: string;
  phoneRaw: string;
  country: string | null;
  budget: string | null;
  projectInterest: string | null;
  source: string;
  status: AssignStatus;
  agentId: string | null;
  assignedAt: number | null;
  claimExpiresAt: number | null;
  stage: string;
  history: string[];
}

// Round-robin pool of agents leads can route to.
export const ROUTING_POOL = ["shatha", "alex", "pasha", "wesam", "khalid"];

const SEED: Omit<Assignment, "status" | "agentId" | "assignedAt" | "claimExpiresAt" | "history">[] = [
  { leadId: "in1", name: "Omar Al Balushi", phoneRaw: "+968 9123 4567", country: "Oman", budget: "75,000 – 100,000 OMR", projectInterest: "Wadi Zaha", source: "ALWALAA", stage: "NEW" },
  { leadId: "in2", name: "Priya Nair", phoneRaw: "+91 98765 43210", country: "India", budget: "50,000 – 75,000 OMR", projectInterest: "Yenaire", source: "ALWALAA", stage: "NEW" },
  { leadId: "in3", name: "James Carter", phoneRaw: "+44 7700 900123", country: "United Kingdom", budget: "150,000 – 200,000 OMR", projectInterest: "Sarooj Oasis", source: "ALWALAA", stage: "NEW" },
  { leadId: "in4", name: "Fatima Al Saadi", phoneRaw: "+971 50 765 4321", country: "United Arab Emirates", budget: "100,000 – 150,000 OMR", projectInterest: "Hay Al Wafaa", source: "ALWALAA", stage: "NEW" },
  { leadId: "in5", name: "Daniel Schmidt", phoneRaw: "+49 151 23456789", country: "Germany", budget: "Below 50,000 OMR", projectInterest: "Wadi Zaha", source: "ALWALAA", stage: "NEW" },
  { leadId: "in6", name: "Aisha Khan", phoneRaw: "+92 300 1234567", country: "Pakistan", budget: "50,000 – 75,000 OMR", projectInterest: "Yenaire", source: "ALWALAA", stage: "NEW" },
];

interface Store {
  items: Map<string, Assignment>;
  rr: number;
}

const g = globalThis as unknown as { __assign?: Store };

function store(): Store {
  if (!g.__assign) {
    const items = new Map<string, Assignment>();
    for (const s of SEED) {
      items.set(s.leadId, { ...s, status: "UNCLAIMED", agentId: null, assignedAt: null, claimExpiresAt: null, history: ["Inbound — awaiting assignment"] });
    }
    g.__assign = { items, rr: 0 };
  }
  return g.__assign;
}

function nextAgent(after: string | null): string {
  const i = after ? ROUTING_POOL.indexOf(after) : -1;
  return ROUTING_POOL[(i + 1) % ROUTING_POOL.length];
}

function routeTo(a: Assignment, agentId: string, note: string) {
  a.status = "ASSIGNED";
  a.agentId = agentId;
  a.assignedAt = Date.now();
  a.claimExpiresAt = Date.now() + CLAIM_WINDOW_MS;
  a.history.push(note);
}

/** Reassign any baskets whose 10-minute window has lapsed. */
export function sweepExpired(): void {
  const s = store();
  const now = Date.now();
  for (const a of s.items.values()) {
    if (a.status === "ASSIGNED" && a.claimExpiresAt && now >= a.claimExpiresAt) {
      const to = nextAgent(a.agentId);
      routeTo(a, to, `⏱ Not accepted in 10 min — re-routed to ${to}`);
    }
  }
}

export function getState(): Assignment[] {
  sweepExpired();
  return Array.from(store().items.values()).sort((x, y) => x.leadId.localeCompare(y.leadId));
}

export function assign(leadId: string, agentId: string): void {
  const a = store().items.get(leadId);
  if (!a) return;
  routeTo(a, agentId, `Assigned to ${agentId}`);
}

export function claim(leadId: string, agentId: string): boolean {
  const a = store().items.get(leadId);
  if (!a || a.status !== "ASSIGNED" || a.agentId !== agentId) return false;
  if (a.claimExpiresAt && Date.now() >= a.claimExpiresAt) return false;
  a.status = "CLAIMED";
  a.claimExpiresAt = null;
  a.history.push(`Accepted by ${agentId}`);
  return true;
}

export function pass(leadId: string): void {
  const a = store().items.get(leadId);
  if (!a) return;
  const to = nextAgent(a.agentId);
  routeTo(a, to, `Passed — re-routed to ${to}`);
}

export function updateStage(leadId: string, stage: string): void {
  const a = store().items.get(leadId);
  if (!a) return;
  a.stage = stage;
  a.history.push(`Stage → ${stage}`);
}
