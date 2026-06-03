import { describe, it, expect } from "vitest";
import { computeAttributionPayout } from "../commission/payout";
import { resolveEffectiveSplitRate, resolveSourceFloor } from "../commission/sourceFloor";
import { FLOORS } from "./fixtures";

describe("computeAttributionPayout", () => {
  it("computes the full chain at 100% share", () => {
    const r = computeAttributionPayout({ dealValue: 100000, sharePct: 1, developerRate: 0.035, agentSplitRate: 0.5 });
    expect(r.attributedValue).toBe(100000);
    expect(r.alwalaaGross).toBe(3500);
    expect(r.agentPayout).toBe(1750);
  });

  it("splits by attribution share (co-broker)", () => {
    const r = computeAttributionPayout({ dealValue: 100000, sharePct: 0.5, developerRate: 0.035, agentSplitRate: 0.5 });
    expect(r.attributedValue).toBe(50000);
    expect(r.alwalaaGross).toBe(1750);
    expect(r.agentPayout).toBe(875);
  });

  it("rounds money to OMR baisa (3 dp) at each step", () => {
    // 42,750.48 × 3.5% = 1,496.2668 -> 1,496.267 ; × 50% = 748.1335 -> 748.134
    const r = computeAttributionPayout({ dealValue: 42750.48, sharePct: 1, developerRate: 0.035, agentSplitRate: 0.5 });
    expect(r.alwalaaGross).toBe(1496.267);
    expect(r.agentPayout).toBe(748.134);
  });
});

describe("source floor (Decision 1 — hybrid split)", () => {
  it("floors own/referral leads at 50% even in a low ladder tier", () => {
    expect(resolveEffectiveSplitRate(0.25, "AGENT_NETWORK", FLOORS)).toBe(0.5);
    expect(resolveEffectiveSplitRate(0.4, "AGENT_NETWORK", FLOORS)).toBe(0.5);
  });

  it("leaves Alwalaa-sourced leads on the ladder rate (no floor)", () => {
    expect(resolveEffectiveSplitRate(0.25, "ALWALAA_SOURCED", FLOORS)).toBe(0.25);
    expect(resolveEffectiveSplitRate(0.4, "ALWALAA_SOURCED", FLOORS)).toBe(0.4);
  });

  it("uses the ladder rate when it exceeds the floor", () => {
    expect(resolveEffectiveSplitRate(0.5, "AGENT_NETWORK", FLOORS)).toBe(0.5);
  });

  it("defaults to no floor for an unknown source", () => {
    expect(resolveSourceFloor("ALWALAA_SOURCED", [])).toBe(0);
  });
});
