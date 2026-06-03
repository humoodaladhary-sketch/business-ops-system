import { NextRequest, NextResponse } from "next/server";
import { AGENTS } from "@/app/_data/dataset";
import { DEMO_COOKIE, type Session } from "@/infrastructure/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Demo sign-in via a plain GET link (no client JS / server-action machinery
// required). Sets the httpOnly session cookie and redirects home.
export function GET(req: NextRequest) {
  const who = req.nextUrl.searchParams.get("who") ?? "";

  let session: Session | null = null;
  if (who === "ceo") {
    session = { userId: "ceo", email: "ceo@alwalaaoman.com", name: "CEO / Admin", role: "ADMIN", agentId: null };
  } else {
    const a = AGENTS.find((x) => x.id === who);
    if (a) session = { userId: a.id, email: `${a.id}@alwalaaoman.com`, name: a.name, role: "AGENT", agentId: a.id };
  }

  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(DEMO_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}
