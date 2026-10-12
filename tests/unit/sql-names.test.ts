// Suite kit v7: adapted from OnePortal tests/unit/sql-names.test.ts (the sanity floor counts this app's schema). Merge hub changes by hand.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FUTURE_KEYWORDS,
  ODBC_RESERVED,
  SSMS_BUILTIN_FUNCTIONS,
  SSMS_KEYWORDS,
  SSMS_OBSERVED,
  TSQL_RESERVED,
} from "./sql-server-keywords";

/*
 * Pins the naming rule for the schema (docs/ARCHITECTURE.md §2, "Data conventions"):
 * every table and column in database/migrations is lower-case snake_case and is not a word SQL
 * Server reserves or SSMS highlights (keywords, SSMS parser words, built-in function names) — and
 * neither is the singular of a plural table name ("users" is not a keyword, but USER is).
 */

const KEYWORDS = new Set([
  ...TSQL_RESERVED,
  ...ODBC_RESERVED,
  ...FUTURE_KEYWORDS,
  ...SSMS_KEYWORDS,
  ...SSMS_BUILTIN_FUNCTIONS,
  ...SSMS_OBSERVED,
]);
const MIGRATIONS_DIR = join(process.cwd(), "database", "migrations");

interface SchemaName {
  kind: "table" | "column";
  name: string;
  file: string;
}

/** Tables from CREATE TABLE, columns from their definitions and from ALTER TABLE … ADD. */
function namesInMigrations(): SchemaName[] {
  const names: SchemaName[] = [];
  for (const file of readdirSync(MIGRATIONS_DIR).filter((each) => each.endsWith(".sql"))) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8").replace(/--.*$/gm, "");

    // The closing ");" may be indented (a CREATE TABLE inside an IF).
    for (const match of sql.matchAll(/CREATE TABLE dbo\.(\w+)\s*\(([\s\S]*?)\n\s*\);/g)) {
      names.push({ kind: "table", name: match[1], file });
      for (const line of match[2].split("\n")) {
        const column = /^\s*([A-Za-z_]\w*)\s+[A-Z]/.exec(line)?.[1];
        if (column && column !== "CONSTRAINT") names.push({ kind: "column", name: column, file });
      }
    }
    for (const match of sql.matchAll(/ALTER TABLE dbo\.\w+\s+ADD\s+([A-Za-z_]\w*)\s+[A-Z]/g)) {
      names.push({ kind: "column", name: match[1], file });
    }
  }
  return names;
}

function keywordProblem(name: string): string | null {
  const upper = name.toUpperCase();
  if (KEYWORDS.has(upper)) return `${upper} is reserved or highlighted by SSMS`;
  const singular = upper.endsWith("IES") ? `${upper.slice(0, -3)}Y` : upper.endsWith("S") ? upper.slice(0, -1) : null;
  if (singular && KEYWORDS.has(singular)) return `its singular ${singular} is reserved or highlighted by SSMS`;
  return null;
}

describe("schema names", () => {
  const names = namesInMigrations();

  it("finds the schema (guards against the parser silently matching nothing)", () => {
    expect(names.filter((each) => each.kind === "table").length).toBeGreaterThanOrEqual(3); // DigiDocs 0001: schema_migrations, user_accounts, user_sessions
    expect(names.filter((each) => each.kind === "column").length).toBeGreaterThanOrEqual(18);
  });

  it("uses no keyword or highlighted word, nor the singular of one", () => {
    const problems = names
      .map((each) => ({ ...each, problem: keywordProblem(each.name) }))
      .filter((each) => each.problem)
      .map((each) => `${each.file}: ${each.kind} ${each.name} — ${each.problem}`);
    expect(problems).toEqual([]);
  });

  it("uses lower-case snake_case", () => {
    const badlyNamed = names.filter((each) => !/^[a-z][a-z0-9_]*$/.test(each.name)).map((each) => `${each.file}: ${each.name}`);
    expect(badlyNamed).toEqual([]);
  });

  it("knows the words that caused the 2026-09-30 renames", () => {
    for (const word of ["users", "sessions", "action", "name", "description", "user_id", "version", "app_name"]) {
      expect(keywordProblem(word), word).not.toBeNull();
    }
    for (const word of ["user_accounts", "account_id", "display_name", "summary", "migration_id", "event_type"]) {
      expect(keywordProblem(word), word).toBeNull();
    }
  });
});
