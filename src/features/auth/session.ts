// Suite kit v7: adapted from OnePortal src/features/auth/session.ts (this app's cookies and user fields). Merge hub changes by hand.
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getConfig } from "@/lib/config";
import { db, type Db } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/tokens";
import type { RoleKey } from "@/features/access/roles";

/**
 * DigiDocs sessions (ARCHITECTURE.md §6). The only writer of dbo.user_sessions.
 *
 * A session starts after OnePortal vouched for the person (src/app/sso/callback). The browser
 * holds a random token in an HttpOnly cookie; the database holds its hash. The session row and
 * the user row are re-read on every request, so leaving, deactivating a user or changing their
 * role or organisation takes effect on the very next request.
 */

/** The signed-in person, as every guard returns it. */
export interface SessionUser {
  id: string;
  sessionId: string;
  email: string;
  fullName: string;
  /**
   * What they may do in DigiDocs (src/features/access/roles.ts). null: no role assigned yet, or
   * their organisation is deactivated — guards then send them to /no-access.
   */
  role: RoleKey | null;
  /** An Enterprise user's organisation; null for every other role. */
  organisationId: string | null;
  organisationName: string | null;
}

// "__Host-" makes the browser refuse the cookie unless it is Secure, host-only and Path=/.
// Plain-HTTP development cannot use the prefix. Names are unique in the suite (hub
// CHILD-APP-GUIDE.md §5.7); src/proxy.ts lists the same two.
function cookieName(): string {
  return getConfig().secureCookies ? "__Host-digidocs_session" : "digidocs_session";
}

// Writing last_seen_at on every request would be a write per page view; every 5 minutes is plenty.
const TOUCH_INTERVAL_MINUTES = 5;

interface SessionRow {
  session_id: string;
  account_id: string;
  email: string;
  full_name: string;
  role_key: RoleKey | null;
  organisation_id: string | null;
  organisation_name: string | null;
  organisation_active: boolean | null;
  needs_touch: number;
}

/** The current session, or null. Cached for the duration of one request. */
export const getCurrentSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(cookieName())?.value;
  if (!token) return null;

  const [row] = await db.query<SessionRow>`
    SELECT s.id AS session_id, u.id AS account_id, u.email, u.full_name, u.role_key, u.organisation_id,
           o.company_name AS organisation_name, o.is_active AS organisation_active,
           CASE WHEN s.last_seen_at < DATEADD(MINUTE, -${TOUCH_INTERVAL_MINUTES}, SYSDATETIMEOFFSET())
                THEN 1 ELSE 0 END AS needs_touch
    FROM dbo.user_sessions s
    JOIN dbo.user_accounts u ON u.id = s.account_id
    LEFT JOIN dbo.organisations o ON o.id = u.organisation_id
    WHERE s.token_hash = ${hashToken(token)}
      AND s.revoked_at IS NULL
      AND s.expires_at > SYSDATETIMEOFFSET()
      AND u.is_active = 1`;
  if (!row) return null;

  if (row.needs_touch) {
    await db.query`UPDATE dbo.user_sessions SET last_seen_at = SYSDATETIMEOFFSET() WHERE id = ${row.session_id}`;
  }

  return {
    id: row.account_id.toLowerCase(),
    sessionId: row.session_id.toLowerCase(),
    email: row.email,
    fullName: row.full_name,
    // A deactivated organisation takes its people's access with it, without ending their session.
    role: row.organisation_active === false ? null : row.role_key,
    organisationId: row.organisation_id?.toLowerCase() ?? null,
    organisationName: row.organisation_name,
  };
});

/** Starts a session and sets the cookie. Call only from a server action or route handler. */
export async function startSession(
  userId: string,
  client: { ipAddress: string | null; userAgent: string | null },
): Promise<void> {
  const { sessionTtlHours, secureCookies } = getConfig();
  const token = generateToken();

  const [session] = await db.query<{ expires_at: Date }>`
    INSERT INTO dbo.user_sessions (account_id, token_hash, ip_address, user_agent, expires_at)
    OUTPUT inserted.expires_at
    VALUES (${userId}, ${hashToken(token)}, ${client.ipAddress}, ${client.userAgent},
            DATEADD(HOUR, ${sessionTtlHours}, SYSDATETIMEOFFSET()))`;

  (await cookies()).set(cookieName(), token, {
    httpOnly: true,
    secure: secureCookies,
    // Lax, not Strict: the hub brings the browser back to /sso/callback with a top-level
    // redirect, and links into this app from elsewhere must keep the person signed in.
    // Server actions carry Next's own Origin check against cross-site posts.
    sameSite: "lax",
    path: "/",
    expires: session.expires_at,
  });
}

/** Ends the current browser's session (server side too) and removes the cookie. */
export async function endCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName())?.value;
  if (token) {
    await db.query`
      UPDATE dbo.user_sessions SET revoked_at = SYSDATETIMEOFFSET()
      WHERE token_hash = ${hashToken(token)} AND revoked_at IS NULL`;
  }
  cookieStore.delete(cookieName());
}

/** Revokes one session, only if it belongs to `userId`. Returns false when it does not. */
export async function revokeSession(db: Db, userId: string, sessionId: string): Promise<boolean> {
  const rows = await db.query`
    UPDATE dbo.user_sessions SET revoked_at = SYSDATETIMEOFFSET()
    OUTPUT inserted.id
    WHERE id = ${sessionId} AND account_id = ${userId} AND revoked_at IS NULL`;
  return rows.length > 0;
}

/** Revokes every live session of a user, optionally keeping one (the caller's own). */
export async function revokeAllSessions(db: Db, userId: string, keepSessionId?: string): Promise<number> {
  const rows = await db.query`
    UPDATE dbo.user_sessions SET revoked_at = SYSDATETIMEOFFSET()
    OUTPUT inserted.id
    WHERE account_id = ${userId}
      AND revoked_at IS NULL
      AND expires_at > SYSDATETIMEOFFSET()
      AND (${keepSessionId ?? null} IS NULL OR id <> ${keepSessionId ?? null})`;
  return rows.length;
}
