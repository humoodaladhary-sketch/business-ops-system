import { NextResponse } from "next/server";

// Owner-only / single-user mode: the app is private to you, with no login.
// (The auth machinery still exists in the codebase but is bypassed.) If you ever
// want a gate again, restore the session check here — and meanwhile keep the
// deployment private via Vercel → Settings → Deployment Protection.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|alwalaa-|api/).*)"],
};
