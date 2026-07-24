import { describe, it, expect } from "vitest";
import { resolveAssignment, type AssignmentRule, type AgentLoad } from "./assignment";

const agents: AgentLoad[] = [
  { agentId: "shatha", openLeads: 2, active: true, senior: true },
  { agentId: "alex", openLeads: 5, active: true },
  { agentId: "pasha", openLeads: 1, active: true },
  { agentId: "former", openLeads: 0, active: false },
];

describe("resolveAssignment (rules engine)", () => {
  it("first match: Arabic + GCC → specific agent", () => {
    const rules: AssignmentRule[] = [{ id: "r1", when: { language: "ar", countryIn: ["SA", "KW", "QA", "BH", "AE"] }, thenAgentId: "shatha" }];
    const r = resolveAssignment({ language: "ar", country: "SA" }, rules, agents);
    expect(r.agentId).toBe("shatha");
    expect(r.ruleId).toBe("r1");
  });

  it("budget > N → senior pool, least-loaded senior", () => {
    const rules: AssignmentRule[] = [{ id: "r2", when: { budgetMin: 200000 }, thenPool: "senior" }];
    expect(resolveAssignment({ budget: 250000 }, rules, agents).agentId).toBe("shatha");
  });

  it("no rule matches → inverse-load round-robin (fewest open leads, active only)", () => {
    const r = resolveAssignment({ language: "en" }, [], agents);
    expect(r.agentId).toBe("pasha");
    expect(r.ruleId).toBeNull();
  });

  it("never assigns to inactive agents", () => {
    expect(resolveAssignment({}, [], agents).agentId).not.toBe("former");
  });
});
