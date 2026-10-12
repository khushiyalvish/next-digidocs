import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getConfig } from "@/lib/config";
import { getRequestInfo } from "@/lib/request-info";
import { safeNextPath } from "@/lib/urls";
import { isThemeKey } from "@/themes";
import { findOrCreateUser } from "@/features/auth/link-user";
import { redeemCode, STATE_COOKIE, THEME_COOKIE } from "@/features/auth/oneportal";
import { startSession } from "@/features/auth/session";

/**
 * GET /sso/callback?code=…&state=… — the callback URL registered in OnePortal (hub
 * CHILD-APP-GUIDE.md §5.6). No guard: the one-time code, redeemed with this app's secret, is the
 * credential. Rule numbers refer to the guide's §6.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const cookieStore = await cookies();
  let saved: { state?: string; returnTo?: string } = {};
  try {
    saved = JSON.parse(cookieStore.get(STATE_COOKIE)?.value ?? "{}");
  } catch {}
  cookieStore.delete({ name: STATE_COOKIE, path: "/sso" });

  // Rule 3: a state that came back must be the one stored for this browser. No state at all
  // means a launch from the hub's tile (accepted; hub CHILD-APP-GUIDE.md §10).
  if (state !== null && state !== saved.state) redirect("/sso/error?reason=state");
  if (!code) redirect("/sso/error?reason=missing-code");

  const signIn = await redeemCode(code); // rule 1: on the server
  if (!signIn) redirect("/sso/error?reason=rejected");

  const userId = await findOrCreateUser(signIn.user); // rule 4
  if (!userId) redirect("/sso/error?reason=no-access");

  await startSession(userId, await getRequestInfo()); // rule 5

  // The hub's theme for this person (§7.3). Kept when the session ends, so the error page matches.
  if (isThemeKey(signIn.theme)) {
    cookieStore.set(THEME_COOKIE, signIn.theme, {
      httpOnly: true,
      secure: getConfig().secureCookies,
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
  }
  redirect(safeNextPath(saved.returnTo));
}
