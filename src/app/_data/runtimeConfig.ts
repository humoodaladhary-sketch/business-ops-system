// Runtime CRM configuration overlay. Editable from the Settings UI immediately
// (in-memory per server instance) and persisted to the database config tables
// when DATABASE_URL is set — so the Commission Studio works in preview and is
// durable in production.
import type { LadderTier, SourceFloor } from "@/domain";
import { DEFAULT_LADDER, DEFAULT_FLOORS } from "./config";

export interface DevRate {
  developer: string;
  ratePct: number; // developer -> Alwalaa, percent (3.5 = 3.5%)
}

export interface InventoryUnit {
  id: string;
  project: string;
  developer: string;
  unitType: string;
  bedrooms: number | null;
  priceOMR: number;
  status: "AVAILABLE" | "RESERVED" | "SOLD";
  published: boolean;
}

export interface RuntimeConfig {
  ladder: LadderTier[];
  floors: SourceFloor[];
  devRates: DevRate[];
  targets: Record<string, number>; // agentId -> monthly OMR (overlay)
  units: InventoryUnit[];
}

const DEFAULT_DEV_RATES: DevRate[] = [
  { developer: "Ahly Sabbour", ratePct: 3.5 },
  { developer: "Sarooj Development", ratePct: 4 },
  { developer: "Muriya", ratePct: 3 },
  { developer: "Al Abrar", ratePct: 3 },
  { developer: "Adante Realty", ratePct: 3 },
  { developer: "Omran Group", ratePct: 3 },
  { developer: "Dar Global", ratePct: 3 },
];

const DEFAULT_UNITS: InventoryUnit[] = [
  { id: "u-wz-st1", project: "Wadi Zaha", developer: "Ahly Sabbour", unitType: "Studio", bedrooms: 0, priceOMR: 52000, status: "AVAILABLE", published: true },
  { id: "u-wz-1b1", project: "Wadi Zaha", developer: "Ahly Sabbour", unitType: "1BHK", bedrooms: 1, priceOMR: 65500, status: "AVAILABLE", published: true },
  { id: "u-so-1b1", project: "Sarooj Oasis", developer: "Sarooj Development", unitType: "1BHK", bedrooms: 1, priceOMR: 56100, status: "AVAILABLE", published: true },
  { id: "u-yn-st1", project: "Yenaire", developer: "Adante Realty", unitType: "Studio", bedrooms: 0, priceOMR: 50104, status: "AVAILABLE", published: false },
  { id: "u-hw-2b1", project: "Hay Al Wafaa", developer: "Al Abrar", unitType: "2BHK", bedrooms: 2, priceOMR: 81950, status: "RESERVED", published: false },
];

const g = globalThis as unknown as { __crmConfig?: RuntimeConfig };

function store(): RuntimeConfig {
  if (!g.__crmConfig) {
    g.__crmConfig = {
      ladder: [...DEFAULT_LADDER],
      floors: [...DEFAULT_FLOORS],
      devRates: [...DEFAULT_DEV_RATES],
      targets: {},
      units: [...DEFAULT_UNITS],
    };
  }
  return g.__crmConfig;
}

export const getLadder = (): LadderTier[] => store().ladder;
export const getFloors = (): SourceFloor[] => store().floors;
export const getDevRates = (): DevRate[] => store().devRates;
export const getTargetOverrides = (): Record<string, number> => store().targets;
export const getUnits = (): InventoryUnit[] => store().units;

export function setLadder(ladder: LadderTier[]): void {
  store().ladder = ladder;
}
export function setFloors(floors: SourceFloor[]): void {
  store().floors = floors;
}
export function setDevRates(rates: DevRate[]): void {
  store().devRates = rates;
}
export function setTarget(agentId: string, amount: number): void {
  store().targets[agentId] = amount;
}
export function upsertUnit(u: InventoryUnit): void {
  const s = store();
  const i = s.units.findIndex((x) => x.id === u.id);
  if (i >= 0) s.units[i] = u;
  else s.units.unshift(u);
}

export function getConfig(): RuntimeConfig {
  return store();
}
