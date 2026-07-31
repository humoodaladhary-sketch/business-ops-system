import { describe, expect, it } from "vitest";
import {
  classifyFollowup,
  STAGE_FOLLOWUP_DAYS,
  summarizeFollowups,
  type FollowupLead,
} from "./followup";

const ASOF = new Date("2026-07-31T12:00:00Z");
const daysAgo = (n: number) => new Date(ASOF.getTime() - n * 86_400_000).toISOString().slice(0, 10);

const lead = (over: Partial<FollowupLead>): FollowupLead => ({
  id: "l1",
  name: "Test Lead",
  stage: "qualified",
  lastTouch: null,
  ...over,
});

describe("classifyFollowup", () => {
  it("does not nudge a lead touched within the stage window", () => {
    expect(classifyFollowup(lead({ lastTouch: daysAgo(3) }), ASOF)).toBeNull();
    expect(classifyFollowup(lead({ lastTouch: daysAgo(STAGE_FOLLOWUP_DAYS.QUALIFIED) }), ASOF)).toBeNull();
  });

  it("nudges a stale lead with exact days over the stage threshold", () => {
    const n = classifyFollowup(lead({ lastTouch: daysAgo(12) }), ASOF);
    expect(n).toMatchObject({ reason: "stale", daysSinceTouch: 12, thresholdDays: 7, daysOverThreshold: 5 });
  });

  it("later stages go cold faster (reservation 2d vs qualified 7d)", () => {
    expect(classifyFollowup(lead({ stage: "reservation", lastTouch: daysAgo(3) }), ASOF)).toMatchObject({
      reason: "stale",
      daysOverThreshold: 1,
    });
    expect(classifyFollowup(lead({ stage: "qualified", lastTouch: daysAgo(3) }), ASOF)).toBeNull();
  });

  it("never guesses staleness without a recorded touch — classifies no_touch_recorded", () => {
    const n = classifyFollowup(lead({ lastTouch: null, registeredOn: daysAgo(40) }), ASOF);
    expect(n).toMatchObject({
      reason: "no_touch_recorded",
      daysSinceTouch: null,
      daysOverThreshold: null,
      daysSinceRegistered: 40,
    });
  });

  it("treats an unparseable touch date as no touch recorded, not as fresh", () => {
    expect(classifyFollowup(lead({ lastTouch: "not-a-date" }), ASOF)).toMatchObject({ reason: "no_touch_recorded" });
  });

  it("never nudges closed leads or unknown stages", () => {
    expect(classifyFollowup(lead({ stage: "closed_won", lastTouch: daysAgo(90) }), ASOF)).toBeNull();
    expect(classifyFollowup(lead({ stage: "closed_lost" }), ASOF)).toBeNull();
    expect(classifyFollowup(lead({ stage: "mystery" }), ASOF)).toBeNull();
  });

  it("accepts canonical stage casing from the dashboards (uppercase) and the DB (lowercase)", () => {
    expect(classifyFollowup(lead({ stage: "NEGOTIATION", lastTouch: daysAgo(10) }), ASOF)).toMatchObject({
      stage: "NEGOTIATION",
      reason: "stale",
    });
  });
});

describe("summarizeFollowups", () => {
  const leads: FollowupLead[] = [
    lead({ id: "fresh", lastTouch: daysAgo(1) }),
    lead({ id: "stale-qualified", lastTouch: daysAgo(20) }), // 13 over
    lead({ id: "stale-negotiation", stage: "negotiation", lastTouch: daysAgo(16) }), // 13 over — tie, later stage
    lead({ id: "stale-mild", stage: "engaged", lastTouch: daysAgo(9) }), // 2 over
    lead({ id: "no-touch-old", lastTouch: null, registeredOn: daysAgo(60) }),
    lead({ id: "no-touch-new", lastTouch: null, registeredOn: daysAgo(5) }),
    lead({ id: "won", stage: "closed_won", lastTouch: daysAgo(400) }),
  ];

  it("counts open, due, stale and no-touch leads separately", () => {
    const s = summarizeFollowups(leads, ASOF);
    expect(s.openCount).toBe(6);
    expect(s.dueCount).toBe(5);
    expect(s.staleCount).toBe(3);
    expect(s.noTouchCount).toBe(2);
    expect(s.byStage).toEqual({ QUALIFIED: 3, NEGOTIATION: 1, ENGAGED: 1 });
  });

  it("sorts worst first: most days over, later stage on ties, then no-touch by oldest registration", () => {
    const s = summarizeFollowups(leads, ASOF);
    expect(s.queue.map((n) => n.id)).toEqual([
      "stale-negotiation", // 13 over, NEGOTIATION beats QUALIFIED on the tie
      "stale-qualified",
      "stale-mild",
      "no-touch-old",
      "no-touch-new",
    ]);
  });

  it("is empty when everything is fresh", () => {
    const s = summarizeFollowups([lead({ lastTouch: daysAgo(0) })], ASOF);
    expect(s.dueCount).toBe(0);
    expect(s.queue).toEqual([]);
  });
});
