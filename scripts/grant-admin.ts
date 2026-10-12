/**
 * Makes a person an LFZ Admin — the way to get the first administrator, who then assigns every
 * other role on the Users page. Run by a person with access to the database:
 *
 *   npm run admin:grant -- --email someone@company.com
 *
 * The person must have opened DigiDocs from OnePortal at least once (that creates their account
 * here). Recorded in the audit log.
 */
import { parseArgs } from "node:util";
import { withTransaction } from "@/lib/db";
import { emailSchema } from "@/lib/schemas";
import { recordAudit } from "@/features/audit/record";
import { grantAdminByEmail } from "@/features/users/writes";

async function main() {
  const { values } = parseArgs({ options: { email: { type: "string" } } });
  const email = emailSchema.safeParse(values.email ?? "");
  if (!email.success) throw new Error("Usage: npm run admin:grant -- --email someone@company.com");

  const granted = await withTransaction(async (tx) => {
    const person = await grantAdminByEmail(tx, email.data);
    if (!person) return null;
    await recordAudit(tx, {
      eventType: "operator.admin_granted",
      actor: null,
      target: `${person.fullName} <${email.data}>`,
      detail: "From the command line",
      ipAddress: null,
    });
    return person;
  });

  if (!granted) {
    throw new Error(
      `No single DigiDocs account has the email ${email.data}. Ask them to open DigiDocs from OnePortal once, then run this again.`,
    );
  }
  console.log(`\n${granted.fullName} <${email.data}> is now an LFZ Admin.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
