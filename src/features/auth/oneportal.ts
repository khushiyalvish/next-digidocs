import "server-only";
import { getConfig } from "@/lib/config";
import { generateToken } from "@/lib/tokens";

/*
 * The OnePortal hub client: the only file that talks to the hub (hub CHILD-APP-GUIDE.md §4–§5).
 * Never log the code, the secret or the token response (§6 rule 7).
 */

export interface OnePortalUser {
  id: string; // permanent hub id: link on this
  email: string;
  full_name: string;
}

/** What a successful exchange gives: the person, and the theme they see in the hub (§4.3). */
export interface OnePortalSignIn {
  user: OnePortalUser;
  theme: string | null; // null: a hub older than contract 1.1
}

/**
 * Cookie names must be unique to this application: browsers share cookies between every app on
 * the same host, whatever the port (§5.7). Same prefix as the session cookie.
 */
export const STATE_COOKIE = "digidocs_sso_state";

/** The theme the hub sent at the last sign-in in this browser (§7.3). Not a secret. */
export const THEME_COOKIE = "digidocs_theme";

export function newState(): string {
  return generateToken();
}

export function authorizeUrl(state: string): string {
  const { onePortal } = getConfig();
  const url = new URL("/sso/authorize", onePortal.url);
  url.searchParams.set("app_id", onePortal.appId);
  url.searchParams.set("state", state);
  return url.toString();
}

/** Exchanges a one-time code for the person. Returns null if the hub refuses it. */
export async function redeemCode(code: string): Promise<OnePortalSignIn | null> {
  const { onePortal } = getConfig();
  const response = await fetch(new URL("/api/sso/token", onePortal.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: onePortal.appId, app_secret: onePortal.appSecret, code }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => null);

  if (response.ok && body?.ok) {
    return { user: body.data.user as OnePortalUser, theme: typeof body.data.theme === "string" ? body.data.theme : null };
  }
  if (response.status === 401) {
    console.error("OnePortal rejected this application's credentials: check ONEPORTAL_APP_ID / ONEPORTAL_APP_SECRET.");
  }
  return null;
}
