import "server-only";
import { readFileSync } from "node:fs";
import type { Db } from "@/lib/db";
import { testUsersFileSchema } from "@/lib/test-users";
import type { RoleKey } from "@/features/access/roles";
import { appTestUserSchema } from "@/features/auth/schemas";
import { saveTestUser } from "@/features/auth/link-user";
import { findOrganisationIdByShortCode } from "@/features/organisations/queries";
import { setUserAccess } from "@/features/users/writes";

/*
 * Creates DigiDocs's test users from database/seed/test-users.json, or brings them in line with it
 * (hub CHILD-APP-GUIDE.md §5.8): the suite's test team plus DigiDocs's own extras. The one place
 * that does it: `npm run test-users:seed` runs only this, `npm run db:seed` runs this and then the
 * sample data. Run by a person, never by the application.
 */

export const TEST_USERS_FILE = "database/seed/test-users.json";

/** A seeded test user, as the sample data needs them. */
export interface SeededPerson {
  hubId: string;
  accountId: string;
  email: string;
  fullName: string;
  role: RoleKey | null;
  organisationId: string | null;
}

/**
 * Saves every test user in the file, with their role and organisation, in the caller's
 * transaction. `domains`: the installation's TEST_USER_EMAIL_DOMAINS; the file is refused unless
 * every address is at one of them. Throws (and the caller's transaction changes nothing) when an
 * id belongs to a real person here or an organisation does not exist.
 */
export async function seedTestUsers(tx: Db, domains: readonly string[]): Promise<SeededPerson[]> {
  const file = testUsersFileSchema(appTestUserSchema, domains).parse(JSON.parse(readFileSync(TEST_USERS_FILE, "utf8")));

  const people: SeededPerson[] = [];
  for (const user of file.users) {
    const accountId = await saveTestUser(tx, user, domains);
    if (!accountId) throw new Error(`${user.email}: its id belongs to a real person here.`);

    const organisationId = user.organisationShortCode ? await findOrganisationIdByShortCode(tx, user.organisationShortCode) : null;
    if (user.organisationShortCode && !organisationId) {
      throw new Error(`${user.email}: no single organisation has the short code ${user.organisationShortCode}.`);
    }
    await setUserAccess(tx, accountId, { role: user.role, organisationId, mobileNumber: null, isActive: true });
    people.push({ hubId: user.id, accountId, email: user.email, fullName: user.fullName, role: user.role, organisationId });
  }
  return people;
}
