// Suite kit v7: copied from OnePortal src/lib/data-clear.ts. Change it in the hub first, then copy it here.
import "server-only";
import { parseArgs } from "node:util";
import { getConfig } from "@/lib/config";
import { db, withTransaction, type Db } from "@/lib/db";

/**
 * `npm run data:clear`: empties chosen parts of a TEST installation's database, so it can be
 * seeded and tried again from a known state (CHILD-APP-GUIDE.md §5.9). The same command in the
 * hub and in every suite application; each one lists its own parts.
 *
 *   npm run data:clear -- --clear test-users,sessions                      shows what would go
 *   npm run data:clear -- --clear test-users,sessions --confirm <database>  deletes it
 *
 * Three things stand between this and a database that matters:
 *   1. the ALLOW_DATA_CLEAR setting, which a live installation never sets;
 *   2. nothing is deleted without --confirm naming the database the connection really is in
 *      (asked from SQL Server, not read from a setting);
 *   3. without --confirm it only counts, so the first run always shows what would be deleted.
 */
export interface ClearPart {
  /** What the person types: lower-case words joined by "-". */
  key: string;
  /** What it deletes, for the list the command prints. */
  clears: string;
  count(db: Db): Promise<number>;
  clear(db: Db): Promise<void>;
  /** Printed after it was cleared, when the person has something to do next. */
  afterwards?: string;
}

/** `--clear a,b` → those parts, in the order they are defined; `all` → every part. */
export function selectParts<Part extends { key: string }>(
  requested: string | undefined,
  parts: Part[],
): { parts: Part[]; unknown: string[] } {
  const keys = (requested ?? "")
    .split(",")
    .map((key) => key.trim().toLowerCase())
    .filter(Boolean);
  if (keys.includes("all")) return { parts, unknown: keys.filter((key) => key !== "all" && !parts.some((part) => part.key === key)) };
  return {
    parts: parts.filter((part) => keys.includes(part.key)),
    unknown: keys.filter((key) => !parts.some((part) => part.key === key)),
  };
}

function stop(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function usage(parts: ClearPart[]): string {
  const width = Math.max(...parts.map((part) => part.key.length), "all".length);
  const lines = [...parts.map((part) => `  ${part.key.padEnd(width)}  ${part.clears}`), `  ${"all".padEnd(width)}  Every part above`];
  return `Usage: npm run data:clear -- --clear <part>[,<part>…] [--confirm <database name>]\n\nParts:\n${lines.join("\n")}`;
}

/**
 * The whole command. `afterClear` runs in the same transaction once the parts are gone (the
 * hub records an audit event there); `summary` reads "test-users: 4, sessions: 12".
 */
export async function runDataClear(
  allParts: ClearPart[],
  afterClear?: (tx: Db, summary: string, databaseName: string) => Promise<void>,
): Promise<void> {
  const { values } = parseArgs({
    options: { clear: { type: "string" }, confirm: { type: "string" } },
  });

  const { parts, unknown } = selectParts(values.clear, allParts);
  if (unknown.length > 0) stop(`Unknown part: ${unknown.join(", ")}.\n\n${usage(allParts)}`);
  if (parts.length === 0) stop(usage(allParts));

  if (!getConfig().allowDataClear) {
    stop(
      "ALLOW_DATA_CLEAR is not true, so nothing was read or deleted.\n" +
        "Set it in .env.local on a test installation only. Never on one real people use.",
    );
  }

  const [{ current_database: databaseName }] = await db.query<{ current_database: string }>`
    SELECT DB_NAME() AS current_database`;

  if (values.confirm === undefined) {
    console.log(`\nDatabase ${databaseName} — this would be deleted:\n`);
    for (const part of parts) {
      console.log(`  ${String(await part.count(db)).padStart(8)}  ${part.key}: ${part.clears}`);
    }
    console.log(`\nNothing was deleted. To delete it, run the same command with --confirm ${databaseName}\n`);
    return;
  }
  if (values.confirm !== databaseName) {
    stop(`--confirm says "${values.confirm}", but this connection is in database "${databaseName}". Nothing was deleted.`);
  }

  const cleared = await withTransaction(async (tx) => {
    const counts: string[] = [];
    for (const part of parts) {
      counts.push(`${part.key}: ${await part.count(tx)}`);
      await part.clear(tx);
    }
    const summary = counts.join(", ");
    await afterClear?.(tx, summary, databaseName);
    return summary;
  });

  console.log(`\nDeleted from ${databaseName} — ${cleared}.`);
  for (const part of parts) {
    if (part.afterwards) console.log(`  ${part.key}: ${part.afterwards}`);
  }
  console.log("");
}
