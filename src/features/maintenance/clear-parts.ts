import "server-only";
import type { Db } from "@/lib/db";
import type { ClearPart } from "@/lib/data-clear";
import { TEST_USER_EMAIL_DOMAIN } from "@/lib/test-users";

/*
 * What `npm run data:clear` can empty in DigiDocs (hub CHILD-APP-GUIDE.md §5.9). Parts are cleared
 * in this order, so rows that point at people come first. user_sessions cascades from
 * user_accounts; imports and exports point at the person who created them, so the parts that
 * delete people delete those people's imports and exports first. Any selection works. Never schema_migrations, and never organisations: they
 * are reference data (0003_enterprises.sql) that people and, later, imports point at. Nor the
 * reference lists of 0004–0005 (HSE codes, countries, ports…): fixed data the forms need.
 *
 * A new table gets a part here, or joins one, in the same change that adds it.
 */

const TEST_USER_PATTERN = `%@${TEST_USER_EMAIL_DOMAIN}`;

async function total(rows: Promise<{ total: number }[]>): Promise<number> {
  return (await rows)[0].total;
}

export const CLEAR_PARTS: ClearPart[] = [
  {
    key: "imports-exports",
    clears: "Every import and export, whatever its status",
    count: (db: Db) => total(db.query`SELECT (SELECT COUNT(*) FROM dbo.imports) + (SELECT COUNT(*) FROM dbo.exports) AS total`),
    clear: async (db: Db) => {
      await db.query`DELETE FROM dbo.imports`;
      await db.query`DELETE FROM dbo.exports`;
    },
  },
  {
    key: "test-users",
    clears: `People ending in @${TEST_USER_EMAIL_DOMAIN}, with their sessions and the imports and exports they created`,
    count: (db: Db) => total(db.query`SELECT COUNT(*) AS total FROM dbo.user_accounts WHERE email LIKE ${TEST_USER_PATTERN}`),
    clear: async (db: Db) => {
      await db.query`DELETE FROM dbo.imports WHERE created_by_account_id IN (SELECT id FROM dbo.user_accounts WHERE email LIKE ${TEST_USER_PATTERN})`;
      await db.query`DELETE FROM dbo.exports WHERE created_by_account_id IN (SELECT id FROM dbo.user_accounts WHERE email LIKE ${TEST_USER_PATTERN})`;
      await db.query`DELETE FROM dbo.user_accounts WHERE email LIKE ${TEST_USER_PATTERN}`;
    },
    afterwards: "create them again with npm run test-users:seed.",
  },
  {
    key: "people",
    clears: "Everyone, with their sessions and every import and export (people are created again at their next sign-in, with the least rights)",
    count: (db: Db) => total(db.query`SELECT COUNT(*) AS total FROM dbo.user_accounts`),
    clear: async (db: Db) => {
      await db.query`DELETE FROM dbo.imports`;
      await db.query`DELETE FROM dbo.exports`;
      await db.query`DELETE FROM dbo.user_accounts`;
    },
    afterwards: "nobody is an LFZ Admin any more: run npm run admin:grant once someone has opened DigiDocs.",
  },
  {
    key: "sessions",
    clears: "Sessions: everyone is sent back through OnePortal",
    count: (db: Db) => total(db.query`SELECT COUNT(*) AS total FROM dbo.user_sessions`),
    clear: async (db: Db) => {
      await db.query`DELETE FROM dbo.user_sessions`;
    },
  },
  {
    key: "audit",
    clears: "The audit log of administrators' changes",
    count: (db: Db) => total(db.query`SELECT COUNT(*) AS total FROM dbo.audit_events`),
    clear: async (db: Db) => {
      await db.query`DELETE FROM dbo.audit_events`;
    },
  },
];
