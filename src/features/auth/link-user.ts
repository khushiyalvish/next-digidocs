import "server-only";
import { db, type Db } from "@/lib/db";
import type { OnePortalUser } from "@/features/auth/oneportal";
import type { AppTestUser } from "@/features/auth/schemas";

/*
 * The only writer of dbo.user_accounts (ARCHITECTURE.md §2). People are linked by their
 * permanent hub id, never by email (hub CHILD-APP-GUIDE.md §5.5, §6 rule 4).
 */

const UNIQUE_VIOLATION = new Set([2601, 2627]);

/**
 * The local user for a hub identity. Known → refresh email and name (they can change in the
 * hub). First sign-in → create with the application's default (least) rights: the hub has
 * already decided this person may open the application. Deactivated locally → null.
 */
export async function findOrCreateUser(hubUser: OnePortalUser): Promise<string | null> {
  const [linked] = await db.query<{ id: string; is_active: boolean }>`
    UPDATE dbo.user_accounts
    SET email = ${hubUser.email}, full_name = ${hubUser.full_name}, updated_at = SYSDATETIMEOFFSET()
    OUTPUT inserted.id, inserted.is_active
    WHERE hub_user_id = ${hubUser.id}`;
  if (linked) return linked.is_active ? linked.id.toLowerCase() : null;

  try {
    const [created] = await db.query<{ id: string }>`
      INSERT INTO dbo.user_accounts (hub_user_id, email, full_name)
      OUTPUT inserted.id
      VALUES (${hubUser.id}, ${hubUser.email}, ${hubUser.full_name})`;
    return created.id.toLowerCase();
  } catch (error) {
    // Two first sign-ins at the same moment: the other one created the row. Use it.
    if (UNIQUE_VIOLATION.has((error as { number?: number }).number ?? 0)) return findOrCreateUser(hubUser);
    throw error;
  }
}

/**
 * Creates a test user's row or brings it in line with database/seed/test-users.json (hub
 * CHILD-APP-GUIDE.md §5.8). Keyed on the hub id, and it cannot touch a real person's row: it only
 * updates rows whose address is at one of `domains` (the installation's TEST_USER_EMAIL_DOMAINS).
 * Returns the account id, or null when the id belongs to a real person here. Role and organisation
 * are then set by the seed through features/users/writes.ts (the writer of the access columns).
 */
export async function saveTestUser(db: Db, user: AppTestUser, domains: readonly string[]): Promise<string | null> {
  const [updated] = await db.query<{ id: string }>`
    UPDATE dbo.user_accounts
    SET email = ${user.email}, full_name = ${user.fullName}, updated_at = SYSDATETIMEOFFSET()
    OUTPUT inserted.id
    WHERE hub_user_id = ${user.id} AND SUBSTRING(email, CHARINDEX('@', email) + 1, 254) IN (${domains})`;
  if (updated) return updated.id.toLowerCase();

  const [created] = await db.query<{ id: string }>`
    INSERT INTO dbo.user_accounts (hub_user_id, email, full_name)
    OUTPUT inserted.id
    SELECT ${user.id}, ${user.email}, ${user.fullName}
    WHERE NOT EXISTS (SELECT 1 FROM dbo.user_accounts WHERE hub_user_id = ${user.id})`;
  return created ? created.id.toLowerCase() : null;
}
