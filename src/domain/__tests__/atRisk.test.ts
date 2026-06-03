import { describe, it, expect } from "vitest";
import { evaluateAtRisk } from "../atRisk";

describe("evaluateAtRisk", () => {
  it("exempts trainees entirely", () => {
    const r = evaluateAtRisk({
      exempt: true,
      inRampWindow: false,
      months: [
        { period: "2026-02", pctOfTarget: 0, dealCount: 0 },
        { period: "2026-03", pctOfTarget: 0, dealCount: 0 },
      ],
    });
    expect(r).toEqual({ watch: false, atRisk: false, reason: null });
  });

  it("exempts agents inside their ramp window", () => {
    const r = evaluateAtRisk({
      exempt: false,
      inRampWindow: true,
      months: [
        { period: "2026-02", pctOfTarget: 0.1, dealCount: 1 },
        { period: "2026-03", pctOfTarget: 0, dealCount: 0 },
      ],
    });
    expect(r.atRisk).toBe(false);
    expect(r.watch).toBe(false);
  });

  it("flags Watch when the latest month has zero closings", () => {
    const r = evaluateAtRisk({
      exempt: false,
      inRampWindow: false,
      months: [{ period: "2026-03", pctOfTarget: 0, dealCount: 0 }],
    });
    expect(r.watch).toBe(true);
    expect(r.atRisk).toBe(false);
  });

  it("flags At Risk on two consecutive months below 50%", () => {
    const r = evaluateAtRisk({
      exempt: false,
      inRampWindow: false,
      months: [
        { period: "2026-02", pctOfTarget: 0.3, dealCount: 1 },
        { period: "2026-03", pctOfTarget: 0.45, dealCount: 1 },
      ],
    });
    expect(r.atRisk).toBe(true);
    expect(r.reason).toMatch(/two consecutive/i);
  });

  it("counts zero-volume months as below threshold", () => {
    const r = evaluateAtRisk({
      exempt: false,
      inRampWindow: false,
      months: [
        { period: "2026-02", pctOfTarget: 0, dealCount: 0 },
        { period: "2026-03", pctOfTarget: 0, dealCount: 0 },
      ],
    });
    expect(r.atRisk).toBe(true);
    expect(r.watch).toBe(true);
  });

  it("clears At Risk once a month recovers to >= 50%", () => {
    const r = evaluateAtRisk({
      exempt: false,
      inRampWindow: false,
      months: [
        { period: "2026-02", pctOfTarget: 0.3, dealCount: 1 },
        { period: "2026-03", pctOfTarget: 0.6, dealCount: 2 },
      ],
    });
    expect(r.atRisk).toBe(false);
  });

  it("does not flag At Risk on a single bad month", () => {
    const r = evaluateAtRisk({
      exempt: false,
      inRampWindow: false,
      months: [{ period: "2026-03", pctOfTarget: 0.2, dealCount: 1 }],
    });
    expect(r.atRisk).toBe(false);
  });
});
