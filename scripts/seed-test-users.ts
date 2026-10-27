/**
 * Creates DigiDocs's test users, or refreshes them (hub CHILD-APP-GUIDE.md §5.8). Safe to run again.
 * Run by a person, on a TEST installation only, against a database with the migrations applied
 * (0003 brings the organisations the file names):
 *
 *   npm run test-users:seed
 *
 * The file holds the suite's test team (@edgeaxis.in) and DigiDocs's own extras (@oneportal.test),
 * so the installation's TEST_USER_EMAIL_DOMAINS must list both. `npm run db:seed` runs this and then
 * the sample data. In OnePortal, the hub's `npm run db:seed` creates the team; DigiDocs's extras,
 * from the hub's folder:
 *   npm run test-users:seed -- --file <this repository>/database/seed/test-users.json --app <App ID>
 */
import { getConfig } from "@/lib/config";
import { withTransaction } from "@/lib/db";
import { seedTestUsers } from "@/features/auth/test-user-seed";

async function main() {
  // One transaction: a file that cannot be applied changes nothing.
  const people = await withTransaction((tx) => seedTestUsers(tx, getConfig().testUserEmailDomains));
  console.log(`\n${people.length} test users are ready in DigiDocs.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
