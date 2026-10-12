/**
 * Creates DigiDocs's test users, or refreshes them (hub CHILD-APP-GUIDE.md §5.8). Safe to run again.
 * Run by a person, on a TEST installation only, against a database with the migrations applied
 * (0003 brings the organisations the file names):
 *
 *   npm run test-users:seed
 *
 * Then create the same people in OnePortal, from the hub's folder:
 *   npm run test-users:seed -- --file <this repository>/database/seed/test-users.json --app <App ID>
 */
import { readFileSync } from "node:fs";
import { withTransaction } from "@/lib/db";
import { testUsersFileSchema } from "@/lib/test-users";
import { appTestUserSchema } from "@/features/auth/schemas";
import { saveTestUser } from "@/features/auth/link-user";
import { findOrganisationIdByShortCode } from "@/features/organisations/queries";
import { setUserAccess } from "@/features/users/writes";

async function main() {
  const file = testUsersFileSchema(appTestUserSchema).parse(
    JSON.parse(readFileSync("database/seed/test-users.json", "utf8")),
  );

  // One transaction: a file that cannot be applied changes nothing.
  await withTransaction(async (tx) => {
    for (const user of file.users) {
      const accountId = await saveTestUser(tx, user);
      if (!accountId) throw new Error(`${user.email}: its id belongs to a real person here.`);

      const organisationId = user.organisationShortCode
        ? await findOrganisationIdByShortCode(tx, user.organisationShortCode)
        : null;
      if (user.organisationShortCode && !organisationId) {
        throw new Error(`${user.email}: no single organisation has the short code ${user.organisationShortCode}.`);
      }
      await setUserAccess(tx, accountId, { role: user.role, organisationId, mobileNumber: null, isActive: true });
    }
  });
  console.log(`\n${file.users.length} test users are ready in DigiDocs.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
