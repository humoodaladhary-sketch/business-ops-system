// Follow-up sequence engine (C4). Pure scheduler + compliance + auto-enroll;
// the runtime ticks enrollments and dispatches actions (tasks / n8n WhatsApp
// templates / email / notify). Persistence + n8n dispatch wire at go-live.

export type StepAction =
  | { kind: "task"; title: string }
  | { kind: "whatsapp"; templateRef: string; vars?: string[] }
  | { kind: "email"; subject: string }
  | { kind: "notify_agent"; text: string };

export interface SequenceStep {
  id: string;
  delayHours: number; // cumulative offset from enrolment
  action: StepAction;
}

export interface Sequence {
  id: string;
  name: string;
  steps: SequenceStep[];
}

export type StopReason = "inbound_reply" | "status_advanced" | "manual_stop";

export interface Enrollment {
  sequenceId: string;
  enrolledAt: number; // epoch ms
  completedSteps: number;
  stopped?: StopReason | null;
}

export interface Signals {
  inbound?: boolean; // lead replied
  advanced?: boolean; // status moved forward
  manualStop?: boolean;
}

export type DueResult =
  | { status: "due"; step: SequenceStep; stepIndex: number; dueAt: number }
  | { status: "waiting"; step: SequenceStep; stepIndex: number; dueAt: number }
  | { status: "done" }
  | { status: "stopped"; stopReason: StopReason };

/** The next action to run for an enrolment, or why it stopped/finished. */
export function nextDue(seq: Sequence, e: Enrollment, now: number, signals: Signals = {}): DueResult {
  if (e.stopped) return { status: "stopped", stopReason: e.stopped };
  if (signals.manualStop) return { status: "stopped", stopReason: "manual_stop" };
  if (signals.inbound) return { status: "stopped", stopReason: "inbound_reply" };
  if (signals.advanced) return { status: "stopped", stopReason: "status_advanced" };
  if (e.completedSteps >= seq.steps.length) return { status: "done" };

  const step = seq.steps[e.completedSteps];
  const dueAt = e.enrolledAt + step.delayHours * 3_600_000;
  return now >= dueAt
    ? { status: "due", step, stepIndex: e.completedSteps, dueAt }
    : { status: "waiting", step, stepIndex: e.completedSteps, dueAt };
}

/**
 * WhatsApp compliance: messaging a conversation older than 24h must use an
 * approved template reference (never free text). Within the 24h session window
 * free text is allowed.
 */
export function isWhatsappCompliant(action: StepAction, conversationAgeHours: number): boolean {
  if (action.kind !== "whatsapp") return true;
  if (conversationAgeHours <= 24) return true;
  return Boolean(action.templateRef);
}

export interface EnrollRule {
  id: string;
  sequenceId: string;
  when: { status?: string; untouchedHours?: number; silentHours?: number };
}

export function shouldEnroll(
  lead: { status: string; lastTouchHours?: number; lastInboundHours?: number },
  rule: EnrollRule,
): boolean {
  if (rule.when.status && lead.status !== rule.when.status) return false;
  if (rule.when.untouchedHours != null && !((lead.lastTouchHours ?? 0) >= rule.when.untouchedHours)) return false;
  if (rule.when.silentHours != null && !((lead.lastInboundHours ?? Infinity) >= rule.when.silentHours)) return false;
  return true;
}

// Seed sequences. WhatsApp steps reference approved templates only.
export const SEED_SEQUENCES: Sequence[] = [
  {
    id: "speed-to-lead",
    name: "New-lead speed (AR/EN)",
    steps: [
      { id: "s1", delayHours: 0, action: { kind: "task", title: "Call now (speed-to-lead)" } },
      { id: "s2", delayHours: 1, action: { kind: "whatsapp", templateRef: "intro_en_ar", vars: ["name", "project"] } },
      { id: "s3", delayHours: 24, action: { kind: "task", title: "Follow-up call" } },
      { id: "s4", delayHours: 72, action: { kind: "whatsapp", templateRef: "options_followup" } },
      { id: "s5", delayHours: 168, action: { kind: "task", title: "Final attempt + set status" } },
    ],
  },
  {
    id: "post-viewing",
    name: "Post-viewing nudge",
    steps: [
      { id: "p1", delayHours: 2, action: { kind: "whatsapp", templateRef: "post_viewing_thanks" } },
      { id: "p2", delayHours: 48, action: { kind: "task", title: "Gauge interest + next step" } },
      { id: "p3", delayHours: 168, action: { kind: "whatsapp", templateRef: "post_viewing_followup" } },
    ],
  },
  {
    id: "dormant-revival",
    name: "Dormant revival (90d+)",
    steps: [
      { id: "r1", delayHours: 0, action: { kind: "whatsapp", templateRef: "reengage_approved" } },
      { id: "r2", delayHours: 120, action: { kind: "task", title: "Personal check-in if opened" } },
    ],
  },
];
