import { describe, it, expect } from "vitest";
import { planInboundLead } from "./planInboundLead";
import { DEFAULT_SCORING } from "@/domain";

const ctx = {
  existing: [],
  projects: [{ id: "wz", name: "Wadi Zaha" }],
  agents: [
    { agentId: "alex", openLeads: 3, active: true },
    { agentId: "pasha", openLeads: 1, active: true },
  ],
  scoring: DEFAULT_SCORING,
  rules: [],
};

describe("planInboundLead", () => {
  it("enriches, scores and routes a brand-new lead", () => {
    const plan = planInboundLead(
      { phone: "+96891234567", message: "مرحبا، أبحث عن استوديو في Wadi Zaha ميزانية 60,000 OMR", source: "WHATSAPP" },
      ctx,
    );
    expect(plan.enriched.e164).toBe("+96891234567");
    expect(plan.enriched.language).toBe("ar");
    expect(plan.enriched.budget).toBe(60000);
    expect(plan.enriched.projectInterestId).toBe("wz");
    expect(plan.dedup.action).toBe("NEW_LEAD");
    expect(plan.assignment?.agentId).toBe("pasha"); // least-loaded active
  });

  it("attaches a touch when an open lead already exists on the phone", () => {
    const plan = planInboundLead(
      { phone: "+96891234567", source: "WHATSAPP" },
      { ...ctx, existing: [{ id: "l1", clientId: null, stage: "ENGAGED" }] },
    );
    expect(plan.dedup.action).toBe("ATTACH_TOUCH");
    expect(plan.assignment).toBeNull();
  });
});
