import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/infrastructure/auth/session";
import { supabaseAdmin, adminConfigured } from "@/infrastructure/auth/admin";
import { requireInternalToken, tokenFromRequest } from "@/infrastructure/auth/internalToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  role: z.enum(["ADMIN", "SALES_HEAD", "FINANCE", "MARKETING", "AGENT"]).default("AGENT"),
  agentId: z.string().nullish(),
  name: z.string().nullish(),
});

// Super Admin provisions a login (email + password). Real users via the Supabase
// Admin API; requires the database + service-role key to be configured.
//
// TWO independent gates, because this endpoint mints persistent Supabase
// accounts with a caller-supplied role — including ADMIN — using the
// service-role key. The session check alone was not enough: in owner-only mode
// `getSession()` resolves every caller to the owner, so the role test passed for
// anyone who could reach the URL, and an anonymous request could create itself a
// real administrator. The token gate does not depend on the session at all, and
// fails closed when INTERNAL_API_TOKEN is unset.
export async function POST(req: NextRequest) {
  const auth = requireInternalToken(tokenFromRequest(req));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Only the Super Admin can create logins." }, { status: 403 });
  }

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { email, password, role, agentId, name } = parsed.data;

  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "Connect Supabase (AUTH_PROVIDER=supabase + service-role key) to provision real logins. See docs/GO-LIVE.md." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name ?? email },
    app_metadata: { role, agent_id: role === "AGENT" ? (agentId ?? null) : null },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, userId: data.user?.id });
}
