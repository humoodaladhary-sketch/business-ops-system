import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDepartment } from "@/app/_departments/config";
import { composeSystem } from "@/app/_departments/persona";
import { deptApi } from "@/lib/deptApi";

// Server-side copilot runner. It lights up from whatever credential is present,
// so the copilot works no matter where the key lives — and never regresses when
// none is set. Priority:
//   1. ANTHROPIC_API_KEY (Vercel env)  -> run the tool-loop directly in Next.js
//      (real live queries via the service-role client, or snapshot grounding if
//      the DB client isn't configured).
//   2. COPILOT_WEBHOOK_URL (n8n)       -> the n8n webhook runs Anthropic with the
//      shared credential, so no key is needed anywhere on our side.
//   3. Supabase edge function (chat)   -> holds its own ANTHROPIC_API_KEY secret.
// The department page's live data always works independently of all of this.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export type ChatMsg = { role: "user" | "assistant"; content: unknown };
export type ChatResult =
  | { ok: true; reply: string }
  | { setup: true; reason?: string }
  | { error: string; detail?: string; status?: number };

// deno-lint-ignore-file — this is Node, but keep the shape loose for the snapshot.
type Snapshot = {
  kpis?: { label: string; value: number; money?: boolean }[];
  chips?: Record<string, number>;
  table?: { title: string; columns: string[]; rows: Record<string, unknown>[] } | null;
  error?: string;
};

// Turn a live snapshot into compact grounding text for the no-tools path.
function groundingText(snap: Snapshot): string {
  if (!snap || snap.error) return "";
  const parts: string[] = [];
  if (snap.kpis?.length) {
    parts.push("KPIs: " + snap.kpis.map((k) => `${k.label}=${k.value}${k.money ? " OMR" : ""}`).join(", "));
  }
  if (snap.chips && Object.keys(snap.chips).length) {
    parts.push("Breakdown: " + Object.entries(snap.chips).map(([k, v]) => `${k}=${v}`).join(", "));
  }
  if (snap.table && snap.table.rows.length) {
    parts.push(`${snap.table.title} (${snap.table.rows.length} shown):\n` + JSON.stringify(snap.table.rows).slice(0, 3500));
  }
  return parts.join("\n");
}

async function callAnthropic(key: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
}

const textFrom = (content: unknown): string =>
  Array.isArray(content)
    ? (content as { type: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim()
    : String(content ?? "");

// Full Anthropic tool-use loop, executing the department's config.ts tools with
// a live service-role DB client. This is the richest path — real queries.
async function toolLoop(key: string, db: SupabaseClient, deptId: string, messages: ChatMsg[]): Promise<ChatResult> {
  const dept = getDepartment(deptId);
  if (!dept) return { error: "unknown_department" };
  const tools = dept.tools.map((x) => ({ name: x.name, description: x.description, input_schema: x.input_schema }));
  const convo: ChatMsg[] = [...messages];

  for (let step = 0; step < 6; step++) {
    const res = await callAnthropic(key, { model: MODEL, max_tokens: 1400, system: await composeSystem(deptId), tools, messages: convo });
    if (!res.ok) return { error: "anthropic", status: res.status, detail: (await res.text()).slice(0, 400) };
    const data = await res.json();
    convo.push({ role: "assistant", content: data.content });

    if (data.stop_reason === "tool_use") {
      const results: unknown[] = [];
      for (const b of data.content as { type: string; id: string; name: string; input: Record<string, unknown> }[]) {
        if (b.type !== "tool_use") continue;
        const tool = dept.tools.find((x) => x.name === b.name);
        let out: unknown;
        try {
          out = tool ? await tool.run(db, b.input ?? {}, deptId) : { error: "unknown tool" };
        } catch (e) {
          out = { error: (e as Error).message };
        }
        results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out).slice(0, 8000) });
      }
      convo.push({ role: "user", content: results });
      continue;
    }
    return { ok: true, reply: textFrom(data.content) || "(no response)" };
  }
  return { ok: true, reply: "Stopped after several steps — try a narrower question." };
}

// Snapshot-grounded single call (no DB client available): still reads live data
// via the edge function's `data` action, then answers from that context.
async function groundedChat(key: string, deptId: string, messages: ChatMsg[]): Promise<ChatResult> {
  let grounding = "";
  try {
    const snap = await deptApi<Snapshot>({ action: "data", department: deptId });
    grounding = groundingText(snap);
  } catch {
    /* data optional — copilot still answers, just without live figures */
  }
  const system = grounding
    ? `${await composeSystem(deptId)}\n\nLIVE DATA (as of now, use these exact figures; do not invent others):\n${grounding}`
    : `${await composeSystem(deptId)}\n\nLive data is unavailable right now — say so if asked for specific figures.`;
  const res = await callAnthropic(key, { model: MODEL, max_tokens: 1200, system, messages });
  if (!res.ok) return { error: "anthropic", status: res.status, detail: (await res.text()).slice(0, 400) };
  const data = await res.json();
  return { ok: true, reply: textFrom(data.content) || "(no response)" };
}

// n8n webhook path: n8n holds the Anthropic credential, so no key on our side.
// We send the grounded system prompt + messages; n8n returns the raw Anthropic
// response (or { reply }). Snapshot grounding keeps the webhook itself trivial.
async function webhookChat(url: string, deptId: string, messages: ChatMsg[]): Promise<ChatResult> {
  let grounding = "";
  try {
    grounding = groundingText(await deptApi<Snapshot>({ action: "data", department: deptId }));
  } catch {
    /* optional */
  }
  const system = grounding
    ? `${await composeSystem(deptId)}\n\nLIVE DATA (use these exact figures):\n${grounding}`
    : await composeSystem(deptId);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ system, model: MODEL, max_tokens: 1200, messages }),
    });
    if (!res.ok) return { error: "webhook", status: res.status, detail: (await res.text()).slice(0, 400) };
    const data = await res.json();
    // Accept either { reply } or a raw Anthropic response { content: [...] }.
    const reply = typeof data.reply === "string" ? data.reply : textFrom(data.content);
    return { ok: true, reply: reply || "(no response)" };
  } catch (e) {
    return { error: "webhook_unreachable", detail: (e as Error).message.slice(0, 200) };
  }
}

export async function runCopilot(deptId: string, messages: ChatMsg[]): Promise<ChatResult> {
  if (!getDepartment(deptId)) return { error: "unknown_department" };

  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    const db = supabaseAdmin();
    return db ? toolLoop(key, db, deptId, messages) : groundedChat(key, deptId, messages);
  }

  const webhook = process.env.COPILOT_WEBHOOK_URL;
  if (webhook) return webhookChat(webhook, deptId, messages);

  // Last resort: the edge function (returns { setup: true } if its own secret is unset).
  try {
    return await deptApi<ChatResult>({ action: "chat", department: deptId, messages });
  } catch (e) {
    return { error: "edge_unreachable", detail: (e as Error).message.slice(0, 200) };
  }
}
