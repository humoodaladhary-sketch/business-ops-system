// Agent analytics over a DataBundle (live DB data or the baked snapshot):
// closings & commission over time, earned vs receivable, and rankings.
import type { DealRecord } from "./dataset";
import type { DataBundle } from "./source";

export interface AgentStats {
  agentId: string;
  name: string;
  role: string;
  status: "ACTIVE" | "FORMER";
  deals: number;
  reservations: number;
  volume: number;
  gross: number;
  earned: number;
  pendingAgent: number;
  alwalaaReceived: number;
  alwalaaReceivable: number;
  avgDeal: number;
  firstClose: string | null;
  lastClose: string | null;
}

const won = (d: DealRecord) => d.stage === "CLOSED_WON";

export function agentStats(data: DataBundle, agentId: string): AgentStats {
  const a = data.agents.find((x) => x.id === agentId);
  const ds = data.deals.filter((d) => d.agentId === agentId);
  const closed = ds.filter(won);
  const dates = closed.map((d) => d.closeDate).filter(Boolean).sort() as string[];
  const volume = closed.reduce((s, d) => s + d.value, 0);
  return {
    agentId,
    name: a?.name ?? agentId,
    role: a?.role ?? "",
    status: a?.status === "FORMER" ? "FORMER" : "ACTIVE",
    deals: closed.length,
    reservations: ds.filter((d) => d.stage === "RESERVATION").length,
    volume,
    gross: closed.reduce((s, d) => s + d.gross, 0),
    earned: ds.filter((d) => d.agentPaid === "PAID").reduce((s, d) => s + d.payout, 0),
    pendingAgent: ds.filter((d) => d.agentPaid !== "PAID").reduce((s, d) => s + d.payout, 0),
    alwalaaReceived: ds.filter((d) => d.devPaid === "RECEIVED").reduce((s, d) => s + d.gross, 0),
    alwalaaReceivable: ds.filter((d) => d.devPaid !== "RECEIVED").reduce((s, d) => s + d.gross, 0),
    avgDeal: closed.length ? volume / closed.length : 0,
    firstClose: dates[0] ?? null,
    lastClose: dates[dates.length - 1] ?? null,
  };
}

export function allAgentStats(data: DataBundle): AgentStats[] {
  const ids = new Set<string>([
    ...data.agents.filter((a) => ["SENIOR", "ADVISOR", "NEW"].includes(a.role) && a.status !== "FORMER").map((a) => a.id),
    ...data.deals.map((d) => d.agentId),
  ]);
  return Array.from(ids).map((id) => agentStats(data, id));
}

export type Metric = "deals" | "volume" | "earned" | "pendingAgent" | "avgDeal";

export function ranking(data: DataBundle, metric: Metric = "volume", includeFormer = false): AgentStats[] {
  return allAgentStats(data)
    .filter((s) => includeFormer || s.status !== "FORMER")
    .sort((a, b) => (b[metric] as number) - (a[metric] as number));
}

export type Grain = "day" | "week" | "month";
export interface Bucket { key: string; label: string; deals: number; volume: number; commission: number }

function isoWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return { year: date.getUTCFullYear(), week };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function bucketKey(dateStr: string, grain: Grain): { key: string; label: string } {
  const d = new Date(dateStr + "T00:00:00Z");
  if (grain === "day") return { key: dateStr, label: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
  if (grain === "month") {
    const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return { key: k, label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
  }
  const { year, week } = isoWeek(d);
  return { key: `${year}-W${String(week).padStart(2, "0")}`, label: `W${week} ${year}` };
}

export function bucketize(deals: DealRecord[], grain: Grain): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const d of deals) {
    if (d.stage !== "CLOSED_WON" || !d.closeDate) continue;
    const { key, label } = bucketKey(d.closeDate, grain);
    const b = map.get(key) ?? { key, label, deals: 0, volume: 0, commission: 0 };
    b.deals += 1;
    b.volume += d.value;
    b.commission += d.payout;
    map.set(key, b);
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export function dealsFor(data: DataBundle, agentId: string | "ALL"): DealRecord[] {
  return agentId === "ALL" ? data.deals : data.deals.filter((d) => d.agentId === agentId);
}

export function teamTotals(data: DataBundle) {
  const s = allAgentStats(data);
  return {
    deals: s.reduce((a, b) => a + b.deals, 0),
    volume: s.reduce((a, b) => a + b.volume, 0),
    earned: s.reduce((a, b) => a + b.earned, 0),
    pendingAgent: s.reduce((a, b) => a + b.pendingAgent, 0),
    alwalaaReceivable: s.reduce((a, b) => a + b.alwalaaReceivable, 0),
  };
}
