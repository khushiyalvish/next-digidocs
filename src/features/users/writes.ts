import "server-only";
import type { Db } from "@/lib/db";
import type { RoleKey } from "@/features/access/roles";

/*
 * The only writer of dbo.user_accounts' ACCESS columns: role_key, organisation_id, mobile_number,
 * is_active (ARCHITECTURE.md §2). The identity columns (hub id, email, name) are written by
 * features/auth/link-user.ts at sign-in.
 */

export interface AccessFields {
  role: RoleKey | null;
  organisationId: string | null;
  mobileNumber: string | null;
  isActive: boolean;
}

/** False: no such person. */
export async function setUserAccess(db: Db, userId: string, fields: AccessFields): Promise<boolean> {
  const rows = await db.query`
    UPDATE dbo.user_accounts
    SET role_key = ${fields.role}, organisation_id = ${fields.organisationId}, mobile_number = ${fields.mobileNumber},
        is_active = ${fields.isActive}, updated_at = SYSDATETIMEOFFSET()
    OUTPUT inserted.id
    WHERE id = ${userId}`;
  return rows.length > 0;
}

/**
 * Makes a person who has signed in at least once an LFZ Admin (the operator's
 * `npm run admin:grant`, to bootstrap the first one). Returns who it was, or null when no account
 * — or more than one — has that email (people are identified by hub id; email is not unique).
 */
export async function grantAdminByEmail(db: Db, email: string): Promise<{ id: string; fullName: string } | null> {
  const [row] = await db.query<{ id: string; full_name: string }>`
    UPDATE target
    SET role_key = 'lfz_admin', organisation_id = NULL, is_active = 1, updated_at = SYSDATETIMEOFFSET()
    OUTPUT inserted.id, inserted.full_name
    FROM dbo.user_accounts target
    WHERE target.email = ${email}
      AND NOT EXISTS (SELECT 1 FROM dbo.user_accounts other WHERE other.email = ${email} AND other.id <> target.id)`;
  return row ? { id: row.id.toLowerCase(), fullName: row.full_name } : null;
}
