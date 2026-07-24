import { NextRequest, NextResponse } from "next/server";
import { DEMO_COOKIE, isSupabaseConfigured, supabaseServer } from "@/infrastructure/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (isSupabaseConfigured()) {
    try {
      await supabaseServer().auth.signOut();
    } catch {
      /* ignore */
    }
  }
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete(DEMO_COOKIE);
  return res;
}
