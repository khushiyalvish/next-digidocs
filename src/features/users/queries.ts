import "server-only";
import { db } from "@/lib/db";
import { containsPattern } from "@/lib/sql-text";
import type { RoleKey } from "@/features/access/roles";
import type { UserStatus } from "@/features/users/schemas";

/*
 * Reads of dbo.user_accounts for administration. Callers are LFZ Admins
 * (requireRole("lfz_admin")), who may see every person. People appear here at their first
 * sign-in through OnePortal; until a role is assigned their status is "waiting".
 */

export const USERS_PAGE_SIZE = 50;

export interface UserListItemDto {
  id: string;
  email: string;
  fullName: string;
  role: RoleKey | null;
  organisationName: string | null;
  status: UserStatus;
  lastSeenAt: string | null;
}

function statusOf(row: { is_active: boolean; role_key: RoleKey | null }): UserStatus {
  if (!row.is_active) return "inactive";
  return row.role_key ? "active" : "waiting";
}

export async function listUsers(filter: {
  q?: string;
  role?: RoleKey;
  status?: UserStatus;
  page: number;
}): Promise<{ users: UserListItemDto[]; total: number }> {
  const pattern = containsPattern(filter.q);
  const role = filter.role ?? null;
  const status = filter.status ?? null;
  const offset = (filter.page - 1) * USERS_PAGE_SIZE;

  const rows = await db.query<{
    id: string;
    email: string;
    full_name: string;
    role_key: RoleKey | null;
    is_active: boolean;
    organisation_name: string | null;
    last_seen_at: Date | null;
    total: number;
  }>`
    SELECT u.id, u.email, u.full_name, u.role_key, u.is_active, o.company_name AS organisation_name,
           (SELECT MAX(s.last_seen_at) FROM dbo.user_sessions s WHERE s.account_id = u.id) AS last_seen_at,
           COUNT(*) OVER () AS total
    FROM dbo.user_accounts u
    LEFT JOIN dbo.organisations o ON o.id = u.organisation_id
    WHERE (${pattern} IS NULL
           OR u.email LIKE ${pattern} ESCAPE '\\'
           OR u.full_name LIKE ${pattern} ESCAPE '\\'
           OR o.company_name LIKE ${pattern} ESCAPE '\\')
      AND (${role} IS NULL OR u.role_key = ${role})
      AND (${status} IS NULL
           OR (${status} = 'inactive' AND u.is_active = 0)
           OR (${status} = 'waiting' AND u.is_active = 1 AND u.role_key IS NULL)
           OR (${status} = 'active' AND u.is_active = 1 AND u.role_key IS NOT NULL))
    ORDER BY CASE WHEN u.is_active = 1 AND u.role_key IS NULL THEN 0 ELSE 1 END, u.full_name, u.email
    OFFSET ${offset} ROWS FETCH NEXT ${USERS_PAGE_SIZE} ROWS ONLY`;

  return {
    total: rows[0]?.total ?? 0,
    users: rows.map((row) => ({
      id: row.id.toLowerCase(),
      email: row.email,
      fullName: row.full_name,
      role: row.role_key,
      organisationName: row.organisation_name,
      status: statusOf(row),
      lastSeenAt: row.last_seen_at?.toISOString() ?? null,
    })),
  };
}

/** How many people signed in and are waiting for a role. For the administrator's home page. */
export async function countWaitingUsers(): Promise<number> {
  const [row] = await db.query<{ total: number }>`
    SELECT COUNT(*) AS total FROM dbo.user_accounts WHERE is_active = 1 AND role_key IS NULL`;
  return row.total;
}

export interface UserDetailDto {
  id: string;
  email: string;
  fullName: string;
  role: RoleKey | null;
  organisationId: string | null;
  mobileNumber: string | null;
  isActive: boolean;
  status: UserStatus;
  createdAt: string;
  lastSeenAt: string | null;
}

export async function getUserForAdmin(id: string): Promise<UserDetailDto | null> {
  const [row] = await db.query<{
    id: string;
    email: string;
    full_name: string;
    role_key: RoleKey | null;
    organisation_id: string | null;
    mobile_number: string | null;
    is_active: boolean;
    created_at: Date;
    last_seen_at: Date | null;
  }>`
    SELECT u.id, u.email, u.full_name, u.role_key, u.organisation_id, u.mobile_number, u.is_active, u.created_at,
           (SELECT MAX(s.last_seen_at) FROM dbo.user_sessions s WHERE s.account_id = u.id) AS last_seen_at
    FROM dbo.user_accounts u
    WHERE u.id = ${id}`;
  if (!row) return null;

  return {
    id: row.id.toLowerCase(),
    email: row.email,
    fullName: row.full_name,
    role: row.role_key,
    organisationId: row.organisation_id?.toLowerCase() ?? null,
    mobileNumber: row.mobile_number,
    isActive: row.is_active,
    status: statusOf(row),
    createdAt: row.created_at.toISOString(),
    lastSeenAt: row.last_seen_at?.toISOString() ?? null,
  };
}
