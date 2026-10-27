// Suite kit v8: copied from OnePortal scripts/migrate.ts. Change it in the hub first, then copy it here.
/**
 * Applies the database migrations this database has not recorded yet, in order (src/lib/migrate.ts).
 *
 *   npm run db:migrate              applies what is pending
 *   npm run db:migrate -- --status  only lists applied and pending files
 *
 * Connects with MIGRATION_DATABASE_CONNECTION_STRING (an account that may change the schema), or
 * DATABASE_CONNECTION_STRING when that is unset. Run it before starting a new build. The database
 * itself is created once by a DBA (database/setup/create_database.sql).
 */
import { parseArgs } from "node:util";
import { getConfig } from "@/lib/config";
import { MigrationStopped, runMigrations } from "@/lib/migrate";

const { values } = parseArgs({ options: { status: { type: "boolean" } } });

runMigrations({
  connectionString: getConfig().migrationConnectionString,
  directory: "database/migrations",
  statusOnly: values.status ?? false,
})
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof MigrationStopped ? `\n${error.message}\n` : error instanceof Error ? error.message : error);
    process.exit(1);
  });
