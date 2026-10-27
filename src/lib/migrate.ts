// Suite kit v8: copied from OnePortal src/lib/migrate.ts. Change it in the hub first, then copy it here.
import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sql from "mssql";

/**
 * `npm run db:migrate`: applies the files in database/migrations/ that this database has not
 * recorded yet, in number order — what a person otherwise does with sqlcmd, one file at a time
 * (database/README.md). The same command in the hub and in every suite application.
 *
 *   npm run db:migrate              applies what is pending
 *   npm run db:migrate -- --status  only lists applied and pending files
 *
 * The files stay the source of truth and keep their own guard: each one runs in its own
 * transaction, records itself in dbo.schema_migrations and does nothing when already applied.
 * This runner adds the order, a list of what it found, and a stop at the first failure.
 *
 * It connects with MIGRATION_DATABASE_CONNECTION_STRING (an account that may change the schema),
 * falling back to DATABASE_CONNECTION_STRING. It is the one place that sends SQL text that is not
 * a `db.query` tagged template: whole files from the repository, never a value from outside.
 */

/** `0003_asset_list_actions.sql` → migration id `0003`. */
export const MIGRATION_FILE_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/;

export interface MigrationFile {
  id: string;
  fileName: string;
}

export interface MigrationPlan {
  files: MigrationFile[];
  pending: MigrationFile[];
  /** Recorded in the database but no file has the id: the database is newer than this code. */
  unknownApplied: string[];
  /** Files that would make the order ambiguous. Nothing is applied while there are any. */
  problems: string[];
}

/** Pure: which files exist, in which order, and which of them the database has not recorded. */
export function planMigrations(fileNames: string[], appliedIds: string[]): MigrationPlan {
  const problems: string[] = [];
  const files: MigrationFile[] = [];
  const byId = new Map<string, string>();

  for (const fileName of [...fileNames].sort()) {
    if (!fileName.toLowerCase().endsWith(".sql")) continue;
    const match = MIGRATION_FILE_PATTERN.exec(fileName);
    if (!match) {
      problems.push(`${fileName}: name it NNNN_what_it_does.sql (four digits, lower-case words joined by _)`);
      continue;
    }
    const earlier = byId.get(match[1]);
    if (earlier) {
      problems.push(`${fileName}: ${earlier} already has number ${match[1]}`);
      continue;
    }
    byId.set(match[1], fileName);
    files.push({ id: match[1], fileName });
  }

  const applied = new Set(appliedIds.map((id) => id.trim()));
  return {
    files,
    pending: files.filter((file) => !applied.has(file.id)),
    unknownApplied: [...applied].filter((id) => !byId.has(id)).sort(),
    problems,
  };
}

/**
 * Pure: a file's text split into batches at lines that hold only `GO`, as sqlcmd does. The suite's
 * migrations are one batch today; this keeps a future file with a CREATE VIEW (which must start a
 * batch) working the same here and in sqlcmd.
 */
export function splitBatches(text: string): string[] {
  return text
    .split(/^[ \t]*GO[ \t]*(?:--.*)?$/im)
    .map((batch) => batch.trim())
    .filter((batch) => batch.length > 0);
}

/** SQL Server's "you may not do that" errors: the login lacks the rights to change the schema. */
const PERMISSION_ERRORS = new Set([229, 230, 262, 297, 300, 1088, 2760, 15151, 15247]);

export class MigrationStopped extends Error {}

function describeError(fileName: string, error: unknown): string {
  const failure = error as { number?: number; lineNumber?: number; message?: string };
  const where = failure.lineNumber ? `${fileName}, line ${failure.lineNumber}` : fileName;
  const lines = [`${where}: ${failure.message ?? String(error)}`];
  if (failure.number !== undefined && PERMISSION_ERRORS.has(failure.number)) {
    lines.push(
      "This login may not change the schema (the app's own login has no DDL rights, by design). Set",
      "MIGRATION_DATABASE_CONNECTION_STRING to an account that may, e.g. the one that ran create_database.sql.",
    );
  }
  lines.push("The file's own transaction was rolled back; nothing after it was applied.");
  return lines.join("\n");
}

export async function runMigrations(options: {
  connectionString: string;
  directory: string;
  statusOnly: boolean;
}): Promise<void> {
  const fileNames = readdirSync(options.directory);

  // One connection for the whole run: a file's batches must share it (its transaction spans them).
  const config = sql.ConnectionPool.parseConnectionString(options.connectionString);
  const pool = new sql.ConnectionPool({ ...config, pool: { min: 0, max: 1, idleTimeoutMillis: 600_000 } });
  await pool.connect();

  try {
    const [where] = (
      await pool.request().query<{ database_name: string; server_name: string | null }>`
        SELECT DB_NAME() AS database_name, @@SERVERNAME AS server_name`
    ).recordset;
    const appliedRows =
      (
        await pool.request().query<{ migration_id: string }>`
          IF OBJECT_ID(N'dbo.schema_migrations', N'U') IS NOT NULL
            SELECT migration_id FROM dbo.schema_migrations`
      ).recordset ?? [];

    const plan = planMigrations(
      fileNames,
      appliedRows.map((row) => row.migration_id),
    );
    const pendingIds = new Set(plan.pending.map((file) => file.id));

    console.log(
      `\nDatabase ${where.database_name}${where.server_name ? ` on ${where.server_name}` : ""}: ` +
        `${plan.files.length - plan.pending.length} applied, ${plan.pending.length} pending.\n`,
    );
    for (const file of plan.files) {
      console.log(`  ${pendingIds.has(file.id) ? "pending" : "applied"}  ${file.fileName}`);
    }
    if (plan.unknownApplied.length > 0) {
      console.log(
        `\n  The database has also recorded ${plan.unknownApplied.join(", ")}, which no file here has: ` +
          "this code may be older than the database.",
      );
    }
    if (plan.problems.length > 0) {
      throw new MigrationStopped(`Nothing was applied. Fix these files first:\n${plan.problems.map((p) => `  - ${p}`).join("\n")}`);
    }
    if (options.statusOnly) {
      console.log(plan.pending.length > 0 ? "\nRun npm run db:migrate to apply what is pending.\n" : "");
      return;
    }
    if (plan.pending.length === 0) {
      console.log("\nNothing to apply.\n");
      return;
    }

    for (const file of plan.pending) {
      console.log(`\nApplying ${file.fileName}`);
      const started = Date.now();
      const text = readFileSync(path.join(options.directory, file.fileName), "utf8");

      try {
        for (const batch of splitBatches(text)) {
          const request = pool.request();
          request.on("info", (info: { message: string }) => console.log(`    ${info.message}`));
          await request.batch(batch);
        }
      } catch (error) {
        // XACT_ABORT has rolled the file's transaction back; make sure nothing is left open.
        await pool.request().batch("IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;").catch(() => {});
        throw new MigrationStopped(describeError(file.fileName, error));
      }

      const recorded = (
        await pool.request().query<{ migration_id: string }>`
          SELECT migration_id FROM dbo.schema_migrations WHERE migration_id = ${file.id}`
      ).recordset;
      if (recorded.length === 0) {
        throw new MigrationStopped(
          `${file.fileName} ran but did not record itself in dbo.schema_migrations. Every migration ends with\n` +
            `INSERT INTO dbo.schema_migrations (migration_id) VALUES ('${file.id}'); — copy the guard from 0001_initial.sql.`,
        );
      }
      console.log(`  done in ${((Date.now() - started) / 1000).toFixed(1)} s`);
    }
    console.log(`\nAll ${plan.files.length} migrations are applied.\n`);
  } finally {
    await pool.close();
  }
}
