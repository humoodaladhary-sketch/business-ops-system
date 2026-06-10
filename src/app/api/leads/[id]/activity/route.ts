import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/infrastructure/auth/session";
import { loadData } from "@/app/_data/source";
import { getActivity, addTouch } from "@/app/_data/activity";
import { hasDatabase, prisma } from "@/infrastructure/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  channel: z.enum(["WHATSAPP", "EMAIL", "CALL", "MEET", "TEAMS", "NOTE"]),
  direction: z.enum(["INBOUND", "OUTBOUND"]).default("OUTBOUND"),
  body: z.string().max(2000).nullish(),
  outcome: z.string().max(80).nullish(),
});

async function authorize(leadId: string) {
  const session = await getSession();
  if (!session) return { error: "Sign in required.", status: 401 as const, session: null };
  if (session.role !== "ADMIN") {
    const lead = (await loadData()).leads.find((l) => l.id === leadId);
    if (lead && lead.agentId && lead.agentId !== session.agentId) {
      return { error: "Not your lead.", status: 403 as const, session: null };
    }
  }
  return { error: null, status: 200 as const, session };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const a = await authorize(params.id);
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  return NextResponse.json({ ok: true, touches: getActivity(params.id) });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await authorize(params.id);
  if (a.error || !a.session) return NextResponse.json({ error: a.error }, { status: a.status });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid touch." }, { status: 400 });
  const b = parsed.data;

  const touch = addTouch(params.id, {
    channel: b.channel,
    direction: b.direction,
    body: b.body ?? undefined,
    outcome: b.outcome ?? undefined,
    agentId: a.session.agentId,
  });

  if (hasDatabase) {
    try {
      await prisma.communicationLog.create({
        data: {
          leadId: params.id,
          agentId: a.session.agentId,
          channel: (b.channel === "MEET" || b.channel === "TEAMS" ? "SYSTEM" : b.channel) as never,
          direction: b.direction as never,
          body: b.body ?? null,
          outcome: b.channel === "CALL" ? (b.outcome as never) : null,
          meta: { uiChannel: b.channel },
        },
      });
    } catch {
      /* in-memory copy already recorded */
    }
  }

  return NextResponse.json({ ok: true, touch, touches: getActivity(params.id), persisted: hasDatabase });
}
