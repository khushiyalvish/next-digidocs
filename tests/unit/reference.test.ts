import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hseSearchSchema } from "@/features/reference/schemas";

/*
 * Pins the reference data migrations (0004, 0005), which were generated from the old DigiDocs dump:
 * they must load as written, because nobody edits them after they are applied.
 */

const migration = (name: string) => readFileSync(join(process.cwd(), "database", "migrations", name), "utf8");

/** The value tuples of the INSERT that starts at `marker`, as raw strings. */
function tuples(sql: string, marker: string): string[] {
  const start = sql.indexOf(marker);
  const end = sql.indexOf(";\n", start);
  return [...sql.slice(start, end).matchAll(/^\s+\((.*)\),?$/gm)].map((match) => match[1]);
}

describe("0005_hse_codes.sql", () => {
  const sql = migration("0005_hse_codes.sql");
  const batches = sql.split("INSERT INTO dbo.hse_codes").slice(1);
  const rows = batches.flatMap((batch) => [...batch.matchAll(/^\s+\((\d+), N'(\d+)'/gm)]);

  it("inserts every HSE code once, in batches SQL Server accepts (at most 1,000 rows)", () => {
    expect(rows.length).toBe(6836);
    for (const batch of batches) expect([...batch.matchAll(/^\s+\(\d+, N'/gm)].length).toBeLessThanOrEqual(1000);
    expect(new Set(rows.map((row) => row[2])).size).toBe(rows.length);
  });
});

describe("0004_reference_lists.sql", () => {
  const sql = migration("0004_reference_lists.sql");

  it("links required documents only to transaction types and documents it inserts", () => {
    const typeIds = new Set(tuples(sql, "INSERT INTO dbo.transaction_types").map((row) => row.split(",")[0]));
    const documentIds = new Set(tuples(sql, "INSERT INTO dbo.document_types").map((row) => row.split(",")[0]));
    const links = tuples(sql, "INSERT INTO dbo.transaction_type_documents");
    expect(links.length).toBe(116);
    for (const link of links) {
      const [type, document] = link.split(",").map((part) => part.trim());
      expect(typeIds.has(type), `transaction type ${type}`).toBe(true);
      expect(documentIds.has(document), `document ${document}`).toBe(true);
    }
  });

  it("has one row per currency code", () => {
    const codes = tuples(sql, "INSERT INTO dbo.currencies").map((row) => row.split(",")[0]);
    expect(codes.length).toBe(153);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("HSE code search filters", () => {
  it("fall back to no filter for anything malformed", () => {
    expect(hseSearchSchema.parse({ page: "zero" })).toEqual({ page: 1 });
    expect(hseSearchSchema.parse({ q: " 0101 ", page: "2" })).toEqual({ q: "0101", page: 2 });
  });
});

describe("migrations from 0006 on", () => {
  it("are pure ASCII, so sqlcmd's code page cannot change their data (write other characters as NCHAR(code))", () => {
    // 0004 and 0005 were not, and were applied with a Windows code page: 0006 had to repair them.
    const files = readdirSync(join(process.cwd(), "database", "migrations")).filter((file) => /^\d{4}_.*\.sql$/.test(file) && Number(file.slice(0, 4)) >= 6);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const offending = migration(file).split("\n").findIndex((line) => /[^\x00-\x7F]/.test(line));
      expect(offending, `${file}: line ${offending + 1} has a non-ASCII character`).toBe(-1);
    }
  });
});
