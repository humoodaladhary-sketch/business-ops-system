import { describe, it, expect } from "vitest";
import { computeLeadScore } from "./score";
import { DEFAULT_SCORING } from "./settings";

describe("computeLeadScore", () => {
  it("scores a hot referral (budget fit + responsiveness + residency + touches)", () => {
    const r = computeLeadScore(
      { channel: "REFERRAL", budgetFit: 1, respondedUnder1h: true, residencyIntent: true, inboundTouches: 3 },
      DEFAULT_SCORING,
    );
    expect(r.score).toBe(89); // 25 + 25 + 15 + 15 + 9
    expect(r.band).toBe("HOT");
  });

  it("bands WARM and COLD by thresholds", () => {
    expect(computeLeadScore({ channel: "WHATSAPP", budgetFit: 1 }, DEFAULT_SCORING).band).toBe("WARM"); // 45
    expect(computeLeadScore({ channel: "IMPORT" }, DEFAULT_SCORING).band).toBe("COLD"); // 5
  });

  it("caps engagement and clamps to 100", () => {
    const r = computeLeadScore(
      { channel: "REFERRAL", budgetFit: 1, respondedUnder1h: true, openedConversation: true, residencyIntent: true, inboundTouches: 100 },
      DEFAULT_SCORING,
    );
    expect(r.breakdown.engagement).toBe(15); // capped
    expect(r.score).toBe(100); // clamped
  });
});
