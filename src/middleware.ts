import { NextResponse, type NextRequest } from "next/server";
import { OWNER_COOKIE, hasValidOwnerCookie, ownerGateEnabled } from "@/infrastructure/auth/ownerGate";

// Owner-only / single-user mode: the app is private to you, with no login.
//
// When OWNER_PASSCODE is set, this gate holds every page and API route behind
// that passcode. When it is not set, the app stays open exactly as before — so
// turning the lock on is a deliberate act and can never strand the owner.
// Keep Vercel → Settings → Deployment Protection on as well; this is a second
// lock, not a replacement for it.
//
// Note the matcher now includes /api: leaving the API out meant a locked app
// still answered data requests to anyone who called the routes directly.
const PUBLIC_PATHS = ["/unlock", "/api/auth/unlock", "/api/health"];

export async function middleware(req: NextRequest) {
  if (!ownerGateEnabled()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  if (await hasValidOwnerCookie(req.cookies.get(OWNER_COOKIE)?.value)) {
    return NextResponse.next();
  }

  // API callers get a status they can act on; browsers get the passcode page.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Locked. Enter the owner passcode at /unlock." }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|alwalaa-).*)"],
};
