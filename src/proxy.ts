import { NextResponse, type NextRequest } from "next/server";

/*
 * Remembers WHERE a signed-out person was going, then sends them through OnePortal
 * (hub CHILD-APP-GUIDE.md §5.4). It checks only that a session cookie exists: a convenience,
 * not security. Every page and action still runs requireUser().
 */

// The two names from src/features/auth/session.ts (HTTPS / plain-HTTP development).
const SESSION_COOKIES = ["__Host-digidocs_session", "digidocs_session"];

export function proxy(request: NextRequest) {
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) return NextResponse.next();

  const login = new URL("/sso/login", request.url);
  login.searchParams.set("returnTo", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except the sign-in routes, Next.js internals and static files.
  matcher: ["/((?!sso/|api/|_next/|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)"],
};
