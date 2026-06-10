import { describe, it, expect } from "vitest";
import { matchUnits, agentsToNotifyForUnit, type UnitRef } from "./matching";
import { DEFAULT_MATCHING } from "./settings";

const units: UnitRef[] = [
  { id: "u1", projectId: "wz", market: "OFF_PLAN", unitType: "Studio", priceOMR: 62000, status: "AVAILABLE" },
  { id: "u2", projectId: "sarooj", market: "OFF_PLAN", unitType: "2BHK", priceOMR: 120000, status: "AVAILABLE" },
  { id: "u3", projectId: "wz", market: "OFF_PLAN", unitType: "Studio", priceOMR: 60000, status: "SOLD" },
];

describe("matchUnits", () => {
  it("ranks budget+type+project fit first and excludes sold", () => {
    const m = matchUnits({ budget: 60000, unitType: "Studio", projectInterestId: "wz" }, units, DEFAULT_MATCHING);
    expect(m[0].unitId).toBe("u1");
    expect(m[0].reasons).toEqual(expect.arrayContaining(["budget fit", "type", "project"]));
    expect(m.some((x) => x.unitId === "u3")).toBe(false);
  });

  it("returns empty when nothing matches", () => {
    expect(matchUnits({ budget: 5000, unitType: "Villa" }, units, DEFAULT_MATCHING)).toEqual([]);
  });
});

describe("agentsToNotifyForUnit", () => {
  it("notifies only agents with matching OPEN leads", () => {
    const leads = [
      { id: "l1", agentId: "alex", open: true, ctx: { budget: 62000, unitType: "Studio", projectInterestId: "wz" } },
      { id: "l2", agentId: "pasha", open: false, ctx: { budget: 62000, unitType: "Studio", projectInterestId: "wz" } },
      { id: "l3", agentId: "alex", open: true, ctx: { budget: 5000 } },
    ];
    expect(agentsToNotifyForUnit(units[0], leads, DEFAULT_MATCHING)).toEqual([{ agentId: "alex", leadIds: ["l1"] }]);
  });
});
