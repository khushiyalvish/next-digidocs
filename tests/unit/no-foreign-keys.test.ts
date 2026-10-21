import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Decision log 2026-10-19: no foreign keys, so any table can be emptied with TRUNCATE TABLE.
 * 0012 drops every one; later migrations must not add any (writers check references instead).
 */

const DIR = join(process.cwd(), "database", "migrations");
const migration = (name: string) => readFileSync(join(DIR, name), "utf8");

describe("no foreign keys", () => {
  it("0012 drops every foreign key and refuses to finish if one is left", () => {
    const sql = migration("0012_drop_foreign_keys.sql");
    expect(sql).toContain("FROM sys.foreign_keys fk");
    expect(sql).toContain("IF EXISTS (SELECT 1 FROM sys.foreign_keys)");
  });

  it("no migration after 0012 adds one", () => {
    const later = readdirSync(DIR).filter((file) => /^\d{4}_.*\.sql$/.test(file) && Number(file.slice(0, 4)) > 12);
    for (const file of later) {
      const sql = migration(file).replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(/\bFOREIGN\s+KEY\b|\bREFERENCES\b/i.test(sql), file).toBe(false);
    }
  });
});

describe("0013 (import item values)", () => {
  it("adds the old Map_ImpExpItem values and the HSE rates to import_items", () => {
    const sql = migration("0013_import_item_values.sql");
    for (const column of [
      "allocated_freight",
      "allocated_insurance",
      "cif_value",
      "ciss_value",
      "etls_value",
      "import_duty_rate",
      "levy_rate",
      "excise_rate",
      "vat_rate",
      "import_duty_value",
      "levy_value",
      "excise_value",
      "vat_value",
    ]) {
      expect(sql, column).toMatch(new RegExp(`ALTER TABLE dbo\\.import_items ADD ${column} DECIMAL\\(`));
    }
  });
});
