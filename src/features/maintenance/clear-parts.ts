import "server-only";
import { getConfig } from "@/lib/config";
import type { Db } from "@/lib/db";
import type { ClearPart } from "@/lib/data-clear";
import { SAMPLE_TRACKING_PREFIX } from "@/features/imports/writes";

/*
 * What `npm run data:clear` can empty in DigiDocs (hub CHILD-APP-GUIDE.md §5.9). Parts are cleared
 * in this order, so rows that point at people come first. There are no foreign keys and nothing
 * cascades (0012, decision log 2026-10-19): each part deletes what points at what it deletes —
 * an import's lines (import_bl_numbers, import_invoices, import_containers, import_items,
 * import_documents, import_status_history) with the import, a person's sessions with the person.
 * `sample-data` removes exactly what `npm run db:seed` made: imports whose tracking number is
 * SAMPLE-NNNN (real ones contain "/"), with their lines.
 * Timeline steps a test user took on someone else's import stay (they name who acted). Uploaded files are not
 * touched (they are in the uploads folder, not the database). Any selection works. Never
 * schema_migrations, and never organisations: they are reference data (0003_enterprises.sql) that
 * people and imports point at. Nor the reference lists of 0004–0005 and 0010 (HSE codes,
 * countries, ports, the key-information settings…): fixed data the forms need.
 *
 * A new table gets a part here, or joins one, in the same change that adds it.
 */

/** The installation's test domains (TEST_USER_EMAIL_DOMAINS), read when a part runs. */
const testDomains = () => getConfig().testUserEmailDomains;

const SAMPLE_PATTERN = `${SAMPLE_TRACKING_PREFIX}%`;

async function total(rows: Promise<{ total: number }[]>): Promise<number> {
  return (await rows)[0].total;
}

/** Every import and export, and every import's lines. */
async function deleteAllImportsAndExports(db: Db) {
  await db.query`DELETE FROM dbo.import_status_history`;
  await db.query`DELETE FROM dbo.import_documents`;
  await db.query`DELETE FROM dbo.import_items`;
  await db.query`DELETE FROM dbo.import_containers`;
  await db.query`DELETE FROM dbo.import_invoices`;
  await db.query`DELETE FROM dbo.import_bl_numbers`;
  await db.query`DELETE FROM dbo.imports`;
  await db.query`DELETE FROM dbo.exports`;
}

export const CLEAR_PARTS: ClearPart[] = [
  {
    key: "sample-data",
    clears: "The sample imports npm run db:seed loaded (tracking numbers SAMPLE-0001…), with their lines and timeline, and nothing else",
    count: (db: Db) =>
      total(db.query`SELECT COUNT(*) AS total FROM dbo.imports WHERE tracking_number LIKE ${SAMPLE_PATTERN} AND tracking_number NOT LIKE '%/%'`),
    clear: async (db: Db) => {
      await db.query`DELETE FROM dbo.import_status_history WHERE import_id IN (SELECT id FROM dbo.imports WHERE tracking_number LIKE ${SAMPLE_PATTERN} AND tracking_number NOT LIKE '%/%')`;
      await db.query`DELETE FROM dbo.import_documents WHERE import_id IN (SELECT id FROM dbo.imports WHERE tracking_number LIKE ${SAMPLE_PATTERN} AND tracking_number NOT LIKE '%/%')`;
      await db.query`DELETE FROM dbo.import_items WHERE import_id IN (SELECT id FROM dbo.imports WHERE tracking_number LIKE ${SAMPLE_PATTERN} AND tracking_number NOT LIKE '%/%')`;
      await db.query`DELETE FROM dbo.import_containers WHERE import_id IN (SELECT id FROM dbo.imports WHERE tracking_number LIKE ${SAMPLE_PATTERN} AND tracking_number NOT LIKE '%/%')`;
      await db.query`DELETE FROM dbo.import_invoices WHERE import_id IN (SELECT id FROM dbo.imports WHERE tracking_number LIKE ${SAMPLE_PATTERN} AND tracking_number NOT LIKE '%/%')`;
      await db.query`DELETE FROM dbo.import_bl_numbers WHERE import_id IN (SELECT id FROM dbo.imports WHERE tracking_number LIKE ${SAMPLE_PATTERN} AND tracking_number NOT LIKE '%/%')`;
      await db.query`DELETE FROM dbo.imports WHERE tracking_number LIKE ${SAMPLE_PATTERN} AND tracking_number NOT LIKE '%/%'`;
    },
    afterwards: "load it again with npm run db:seed. A file someone uploaded to a sample import stays in the uploads folder.",
  },
  {
    key: "imports-exports",
    clears:
      "Every import and export, whatever its status, hidden ones too, with their lines (BL numbers, invoices, containers, items, document records, timeline). The uploaded files stay in the uploads folder: empty its imports folder by hand",
    count: (db: Db) => total(db.query`SELECT (SELECT COUNT(*) FROM dbo.imports) + (SELECT COUNT(*) FROM dbo.exports) AS total`),
    clear: deleteAllImportsAndExports,
  },
  {
    key: "test-users",
    clears: "People at a TEST_USER_EMAIL_DOMAINS domain, with their sessions and the imports and exports they created",
    count: (db: Db) =>
      total(db.query`
        SELECT COUNT(*) AS total FROM dbo.user_accounts WHERE SUBSTRING(email, CHARINDEX('@', email) + 1, 254) IN (${testDomains()})`),
    clear: async (db: Db) => {
      const domains = testDomains();
      // Their imports' lines first, then their imports and exports.
      await db.query`DELETE FROM dbo.import_status_history WHERE import_id IN (SELECT i.id FROM dbo.imports i JOIN dbo.user_accounts a ON a.id = i.created_by_account_id WHERE SUBSTRING(a.email, CHARINDEX('@', a.email) + 1, 254) IN (${domains}))`;
      await db.query`DELETE FROM dbo.import_documents WHERE import_id IN (SELECT i.id FROM dbo.imports i JOIN dbo.user_accounts a ON a.id = i.created_by_account_id WHERE SUBSTRING(a.email, CHARINDEX('@', a.email) + 1, 254) IN (${domains}))`;
      await db.query`DELETE FROM dbo.import_items WHERE import_id IN (SELECT i.id FROM dbo.imports i JOIN dbo.user_accounts a ON a.id = i.created_by_account_id WHERE SUBSTRING(a.email, CHARINDEX('@', a.email) + 1, 254) IN (${domains}))`;
      await db.query`DELETE FROM dbo.import_containers WHERE import_id IN (SELECT i.id FROM dbo.imports i JOIN dbo.user_accounts a ON a.id = i.created_by_account_id WHERE SUBSTRING(a.email, CHARINDEX('@', a.email) + 1, 254) IN (${domains}))`;
      await db.query`DELETE FROM dbo.import_invoices WHERE import_id IN (SELECT i.id FROM dbo.imports i JOIN dbo.user_accounts a ON a.id = i.created_by_account_id WHERE SUBSTRING(a.email, CHARINDEX('@', a.email) + 1, 254) IN (${domains}))`;
      await db.query`DELETE FROM dbo.import_bl_numbers WHERE import_id IN (SELECT i.id FROM dbo.imports i JOIN dbo.user_accounts a ON a.id = i.created_by_account_id WHERE SUBSTRING(a.email, CHARINDEX('@', a.email) + 1, 254) IN (${domains}))`;
      await db.query`DELETE FROM dbo.imports WHERE created_by_account_id IN (SELECT id FROM dbo.user_accounts WHERE SUBSTRING(email, CHARINDEX('@', email) + 1, 254) IN (${domains}))`;
      await db.query`DELETE FROM dbo.exports WHERE created_by_account_id IN (SELECT id FROM dbo.user_accounts WHERE SUBSTRING(email, CHARINDEX('@', email) + 1, 254) IN (${domains}))`;
      // A record someone else created but a test user hid or uploaded to stays; only "who" is forgotten.
      await db.query`UPDATE dbo.imports SET deleted_by_account_id = NULL WHERE deleted_by_account_id IN (SELECT id FROM dbo.user_accounts WHERE SUBSTRING(email, CHARINDEX('@', email) + 1, 254) IN (${domains}))`;
      await db.query`UPDATE dbo.exports SET deleted_by_account_id = NULL WHERE deleted_by_account_id IN (SELECT id FROM dbo.user_accounts WHERE SUBSTRING(email, CHARINDEX('@', email) + 1, 254) IN (${domains}))`;
      await db.query`UPDATE dbo.import_documents SET uploaded_by_account_id = NULL WHERE uploaded_by_account_id IN (SELECT id FROM dbo.user_accounts WHERE SUBSTRING(email, CHARINDEX('@', email) + 1, 254) IN (${domains}))`;
      await db.query`DELETE FROM dbo.user_sessions WHERE account_id IN (SELECT id FROM dbo.user_accounts WHERE SUBSTRING(email, CHARINDEX('@', email) + 1, 254) IN (${domains}))`;
      await db.query`DELETE FROM dbo.user_accounts WHERE SUBSTRING(email, CHARINDEX('@', email) + 1, 254) IN (${domains})`;
    },
    afterwards: "create them again with npm run db:seed (or npm run test-users:seed for the people only).",
  },
  {
    key: "people",
    clears: "Everyone, with their sessions and every import and export (people are created again at their next sign-in, with the least rights)",
    count: (db: Db) => total(db.query`SELECT COUNT(*) AS total FROM dbo.user_accounts`),
    clear: async (db: Db) => {
      await deleteAllImportsAndExports(db);
      await db.query`DELETE FROM dbo.user_sessions`;
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
