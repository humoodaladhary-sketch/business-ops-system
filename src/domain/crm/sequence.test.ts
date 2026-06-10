import { describe, it, expect } from "vitest";
import { nextDue, isWhatsappCompliant, shouldEnroll, SEED_SEQUENCES, type Enrollment } from "./sequence";

const seq = SEED_SEQUENCES[0]; // speed-to-lead: offsets 0,1,24,72,168
const HOUR = 3_600_000;

describe("nextDue (scheduler)", () => {
  it("first step is due at enrolment", () => {
    const r = nextDue(seq, { sequenceId: seq.id, enrolledAt: 0, completedSteps: 0 }, 0);
    expect(r.status).toBe("due");
    if (r.status === "due") expect(r.stepIndex).toBe(0);
  });

  it("waits until the next step's delay elapses", () => {
    const e: Enrollment = { sequenceId: seq.id, enrolledAt: 0, completedSteps: 1 }; // step 2 due at +1h
    expect(nextDue(seq, e, 0).status).toBe("waiting");
    expect(nextDue(seq, e, HOUR).status).toBe("due");
  });

  it("stops on inbound reply / status advance / manual stop", () => {
    const e: Enrollment = { sequenceId: seq.id, enrolledAt: 0, completedSteps: 0 };
    expect(nextDue(seq, e, 0, { inbound: true })).toMatchObject({ status: "stopped", stopReason: "inbound_reply" });
    expect(nextDue(seq, e, 0, { advanced: true })).toMatchObject({ status: "stopped", stopReason: "status_advanced" });
    expect(nextDue(seq, e, 0, { manualStop: true })).toMatchObject({ status: "stopped", stopReason: "manual_stop" });
  });

  it("is done after the last step", () => {
    expect(nextDue(seq, { sequenceId: seq.id, enrolledAt: 0, completedSteps: seq.steps.length }, 1e12).status).toBe("done");
  });
});

describe("WhatsApp compliance + auto-enrol", () => {
  it("blocks free-text WhatsApp >24h, allows approved templates & non-WhatsApp", () => {
    expect(isWhatsappCompliant({ kind: "whatsapp", templateRef: "intro_en_ar" }, 48)).toBe(true);
    expect(isWhatsappCompliant({ kind: "whatsapp", templateRef: "" }, 48)).toBe(false);
    expect(isWhatsappCompliant({ kind: "whatsapp", templateRef: "" }, 5)).toBe(true); // within 24h window
    expect(isWhatsappCompliant({ kind: "task", title: "Call" }, 48)).toBe(true);
  });

  it("auto-enrols on status + untouched window", () => {
    const rule = { id: "r", sequenceId: "speed-to-lead", when: { status: "NEW", untouchedHours: 24 } };
    expect(shouldEnroll({ status: "NEW", lastTouchHours: 25 }, rule)).toBe(true);
    expect(shouldEnroll({ status: "NEW", lastTouchHours: 5 }, rule)).toBe(false);
  });
});
