import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  OWNER_COOKIE,
  expectedCookieValue,
  ownerGateEnabled,
  ownerPasscode,
  passcodeMatches,
} from "@/infrastructure/auth/ownerGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ passcode: z.string().min(1).max(200) });

// Exchanges the owner passcode for the unlock cookie. Reachable while locked —
// it is on the middleware's public list — so it does its own checking.
export async function POST(req: NextRequest) {
  if (!ownerGateEnabled()) {
    return NextResponse.json({ error: "No passcode is configured — the app is not locked." }, { status: 400 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the passcode." }, { status: 400 });
  }

  if (!(await passcodeMatches(parsed.data.passcode))) {
    // Deliberately vague, and no hint about length or format.
    return NextResponse.json({ error: "That passcode is not correct." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(OWNER_COOKIE, await expectedCookieValue(ownerPasscode()!), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

/** Signs out of the locked app. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OWNER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
