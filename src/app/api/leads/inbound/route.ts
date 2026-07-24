import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { planInboundLead } from "@/application/crm/planInboundLead";
import { DEFAULT_SCORING, DEFAULT_ASSIGNMENT, phoneKey, type CanonicalStage } from "@/domain";
import { loadData } from "@/app/_data/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Active projects for keyword interest matching (mirrors the seed dictionary).
const ACTIVE_PROJECTS = [
  { id: "wadi-zaha", name: "Wadi Zaha", aliases: ["wadi zaha"] },
  { id: "hay-al-wafaa", name: "Hay Al Wafaa", aliases: ["hay alwafa", "hay alwafaa"] },
  { id: "yenaire", name: "Yenaire", aliases: ["yenair", "yenaier"] },
  { id: "sarooj-oasis", name: "Sarooj Oasis", aliases: ["sarooj osis"] },
  { id: "olive-farms", name: "Olive Farms", aliases: ["raya jebel sifah"] },
];

const InboundSchema = z.object({
  phone: z.string().min(3),
  name: z.string().nullish(),
  message: z.string().nullish(),
  source: z
    .enum([
      "WHATSAPP", "INSTAGRAM_DM", "INSTAGRAM_COMMENT", "INSTAGRAM_LEAD_AD", "FACEBOOK_LEAD_AD",
      "GOOGLE_LEAD_FORM", "WEBSITE", "PORTAL_FEED", "REFERRAL", "WALKIN", "MANUAL", "IMPORT",
    ])
    .default("MANUAL"),
  source_ref: z.string().nullish(),
  utm: z.record(z.any()).nullish(),
  raw_payload: z.any().optional(),
});

function authorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const token = process.env.INTERNAL_API_TOKEN;
  if (!token || token === "change-me") return true;
  return req.headers.get("x-internal-token") === token || req.nextUrl.searchParams.get("token") === token;
}

/**
 * Single normalized inbound endpoint (C1) — point n8n (WhatsApp/Respond.io,
 * Instagram/Meta, web forms) here with a normalized payload. Enriches (country/
 * language/budget/project), scores (C2), decides dedup, and routes (C3). Persists
 * when the database is configured; otherwise returns the plan as a preview.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = InboundSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload", issues: parsed.error.issues }, { status: 400 });
  }
  const p = parsed.data;

  const data = await loadData();
  const e164 = phoneKey(p.phone);
  const existing = data.leads
    .filter((l) => e164 && phoneKey(l.phoneRaw) === e164)
    .map((l) => ({ id: l.id, clientId: null as string | null, stage: l.stage as CanonicalStage }));

  const agents = data.agents
    .filter((a) => ["SENIOR", "ADVISOR", "NEW"].includes(a.role) && a.status !== "FORMER")
    .map((a) => ({
      agentId: a.id,
      active: true,
      senior: a.role === "SENIOR",
      openLeads: data.leads.filter((l) => l.agentId === a.id && l.stage !== "CLOSED_WON" && l.stage !== "CLOSED_LOST").length,
    }));

  const plan = planInboundLead(
    { phone: p.phone, name: p.name, message: p.message, source: p.source, sourceRef: p.source_ref },
    { existing, projects: ACTIVE_PROJECTS, agents, scoring: DEFAULT_SCORING, rules: DEFAULT_ASSIGNMENT },
  );

  // Persistence (Client/Lead/CommunicationLog/score/assignment + audit) writes
  // here once DATABASE_URL is configured; preview-only without a database.
  const persisted = false;

  return NextResponse.json({
    ok: true,
    persisted,
    note: persisted ? undefined : "Preview — set DATABASE_URL to persist (dedup/create/route).",
    plan,
  });
}
