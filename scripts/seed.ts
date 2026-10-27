/**
 * Brings a TEST installation's DigiDocs data up (hub CHILD-APP-GUIDE.md §3.7, §5.8, §5.10): the
 * test users (database/seed/test-users.json, the suite's test team and DigiDocs's extras), then the
 * sample imports (database/seed/sample-data.json), in one transaction. Safe to run again: it never
 * duplicates and never deletes (`npm run data:clear -- --clear sample-data` does).
 *
 *   npm run db:seed
 *
 * Refused unless ALLOW_SAMPLE_DATA=true; TEST_USER_EMAIL_DOMAINS must list the team's domain
 * ("oneportal.test,edgeaxis.in"). Run by a person after `npm run db:migrate`, never by the
 * application. The hub's own `npm run db:seed` creates the same people there.
 */
import { getConfig } from "@/lib/config";
import { withTransaction } from "@/lib/db";
import { seedTestUsers } from "@/features/auth/test-user-seed";
import { seedSampleData } from "@/features/sample-data/seed";

async function main() {
  const { allowSampleData, testUserEmailDomains } = getConfig();
  if (!allowSampleData) {
    throw new Error("ALLOW_SAMPLE_DATA is not true, so nothing was seeded. Test installations only (.env.local).");
  }
  // People first, then what points at them; one transaction, so a file that cannot be applied changes nothing.
  const { people, samples } = await withTransaction(async (tx) => {
    const people = await seedTestUsers(tx, testUserEmailDomains);
    return { people, samples: await seedSampleData(tx, people) };
  });
  console.log(
    `\n${people.length} test users are ready in DigiDocs.` +
      `\nSample imports: ${samples.created} created, ${samples.skipped} already there.\n`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
