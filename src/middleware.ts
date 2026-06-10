import { NextResponse, type NextRequest } from "next/server";

// Gate every app route behind a session. Supabase sets `sb-*` cookies; the demo
// login sets `alwalaa_demo_session`. The cron sweep and static assets are open.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/setup") || // first-run page; its POST is token-gated
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/portal/sweep")
  ) {
    return NextResponse.next();
  }

  const hasDemo = req.cookies.has("alwalaa_demo_session");
  const hasSupabase = req.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (hasDemo || hasSupabase) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Gate page routes only. API routes (api/*) do their own token/session auth,
  // so machine callers (n8n, cron) aren't bounced to /login.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|alwalaa-|api/).*)"],
};
