import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getConfig } from "@/lib/config";
import { safeNextPath } from "@/lib/urls";
import { authorizeUrl, newState, STATE_COOKIE } from "@/features/auth/oneportal";

/**
 * GET /sso/login — starts a sign-in through OnePortal (hub CHILD-APP-GUIDE.md §5.6). No guard:
 * this is how a signed-out person becomes signed in. `returnTo` is checked by safeNextPath.
 */
export async function GET(request: NextRequest) {
  const state = newState();
  const returnTo = safeNextPath(request.nextUrl.searchParams.get("returnTo"));

  (await cookies()).set(STATE_COOKIE, JSON.stringify({ state, returnTo }), {
    httpOnly: true,
    secure: getConfig().secureCookies,
    sameSite: "lax", // must be Lax: the hub brings the browser back with a top-level redirect
    path: "/sso",
    maxAge: 10 * 60,
  });
  redirect(authorizeUrl(state));
}
