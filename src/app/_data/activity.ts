// Per-lead conversation/activity log (C7). Every touch — assignment, WhatsApp,
// email, call, meeting, note — lands here so the whole lead journey is tracked
// in Alwalaa OS. In-memory for the preview; persists to CommunicationLog when
// the database is connected.

export type ActChannel = "WHATSAPP" | "EMAIL" | "CALL" | "MEET" | "TEAMS" | "NOTE" | "SYSTEM";
export type ActDirection = "INBOUND" | "OUTBOUND" | "SYSTEM";

export interface Touch {
  id: string;
  leadId: string;
  channel: ActChannel;
  direction: ActDirection;
  body?: string;
  outcome?: string;
  agentId?: string | null;
  at: number; // epoch ms
}

const g = globalThis as unknown as { __activity?: Map<string, Touch[]> };

function store(): Map<string, Touch[]> {
  if (!g.__activity) {
    g.__activity = new Map();
    // A little seed so the timeline isn't empty in the preview.
    const now = Date.now();
    g.__activity.set("ld1", [
      { id: "t1", leadId: "ld1", channel: "SYSTEM", direction: "SYSTEM", body: "Lead assigned to Alex", at: now - 1000 * 60 * 60 * 26 },
      { id: "t2", leadId: "ld1", channel: "WHATSAPP", direction: "OUTBOUND", body: "Intro + Wadi Zaha options (template: intro_en_ar)", at: now - 1000 * 60 * 60 * 25 },
      { id: "t3", leadId: "ld1", channel: "CALL", direction: "OUTBOUND", outcome: "connected", body: "Qualified budget & timeline", at: now - 1000 * 60 * 60 * 22 },
    ]);
  }
  return g.__activity;
}

export function getActivity(leadId: string): Touch[] {
  return [...(store().get(leadId) ?? [])].sort((a, b) => b.at - a.at);
}

export function addTouch(leadId: string, t: Omit<Touch, "id" | "leadId" | "at"> & { at?: number }): Touch {
  const touch: Touch = { id: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, leadId, at: t.at ?? Date.now(), ...t };
  const arr = store().get(leadId) ?? [];
  arr.push(touch);
  store().set(leadId, arr);
  return touch;
}
