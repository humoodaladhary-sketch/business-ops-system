import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDepartment } from "@/app/_departments/config";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  department: z.string(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.any() })).max(40),
});

type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: string; [k: string]: unknown };

const MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const dept = getDepartment(parsed.data.department);
  if (!dept) return NextResponse.json({ error: "unknown_department" }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const db = supabaseAdmin();
  if (!apiKey || !db) {
    // Signal the UI to show a setup panel rather than erroring.
    return NextResponse.json({
      setup: true,
      missing: { anthropicKey: !apiKey, supabase: !db },
    });
  }

  const tools = dept.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
  const system =
    dept.system +
    `\n\nToday is ${new Date().toISOString().slice(0, 10)}. The database may be sparse while integrations fill it — if a tool returns zero rows, say so plainly rather than guessing.`;

  const convo = parsed.data.messages.map((m) => ({ role: m.role, content: m.content })) as {
    role: "user" | "assistant";
    content: unknown;
  }[];

  for (let step = 0; step < 6; step++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1200, system, tools, messages: convo }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      return NextResponse.json({ error: "anthropic", status: res.status, detail });
    }
    const data = (await res.json()) as { stop_reason: string; content: AnthropicBlock[] };
    convo.push({ role: "assistant", content: data.content });

    if (data.stop_reason === "tool_use") {
      const results: { type: "tool_result"; tool_use_id: string; content: string }[] = [];
      for (const block of data.content) {
        if (block.type === "tool_use") {
          const b = block as { id: string; name: string; input: Record<string, unknown> };
          const tool = dept.tools.find((t) => t.name === b.name);
          let out: unknown;
          try {
            out = tool ? await tool.run(db, b.input ?? {}, dept.id) : { error: `unknown tool ${b.name}` };
          } catch (e) {
            out = { error: (e as Error).message };
          }
          results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out).slice(0, 8000) });
        }
      }
      convo.push({ role: "user", content: results });
      continue;
    }

    const text = data.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ ok: true, reply: text || "(no response)" });
  }

  return NextResponse.json({ ok: true, reply: "I ran several steps but didn't converge — try narrowing the question." });
}
