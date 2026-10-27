// Suite kit v8: copied from OnePortal tests/unit/migrate.test.ts. Change it in the hub first, then copy it here.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planMigrations, splitBatches } from "@/lib/migrate";

describe("db:migrate — which files, in which order (lib/migrate.ts)", () => {
  it("orders by number and leaves out what the database has recorded", () => {
    const plan = planMigrations(["0002_themes.sql", "0001_initial.sql", "0003_more.sql", "README.md"], ["0001"]);
    expect(plan.files.map((file) => file.id)).toEqual(["0001", "0002", "0003"]);
    expect(plan.pending.map((file) => file.fileName)).toEqual(["0002_themes.sql", "0003_more.sql"]);
    expect(plan.problems).toEqual([]);
  });

  it("applies a gap too: an older file that was skipped is still pending", () => {
    expect(planMigrations(["0001_a.sql", "0002_b.sql", "0003_c.sql"], ["0001", "0003"]).pending.map((f) => f.id)).toEqual(["0002"]);
  });

  it("refuses a badly named file and two files with one number", () => {
    expect(planMigrations(["0001_a.sql", "1_b.sql", "0002_Add-Thing.sql"], []).problems).toHaveLength(2);
    expect(planMigrations(["0001_a.sql", "0001_b.sql"], []).problems).toEqual(["0001_b.sql: 0001_a.sql already has number 0001"]);
  });

  it("reports recorded ids that no file has (the code is older than the database)", () => {
    expect(planMigrations(["0001_a.sql"], ["0001", "0002"]).unknownApplied).toEqual(["0002"]);
  });

  it("this repository's migrations plan cleanly and each records its own id", () => {
    const names = readdirSync("database/migrations");
    const plan = planMigrations(names, []);
    expect(plan.problems).toEqual([]);
    expect(plan.files.length).toBeGreaterThan(0);
    for (const file of plan.files) {
      expect(readFileSync(`database/migrations/${file.fileName}`, "utf8")).toContain(
        `INSERT INTO dbo.schema_migrations (migration_id) VALUES ('${file.id}')`,
      );
    }
  });
});

describe("db:migrate — batches split at GO, as sqlcmd does", () => {
  it("keeps a file without GO as one batch", () => {
    expect(splitBatches("SET NOCOUNT ON;\nSELECT 1;\n")).toEqual(["SET NOCOUNT ON;\nSELECT 1;"]);
  });

  it("splits at lines holding only GO, in any case, and drops empty batches", () => {
    expect(splitBatches("SELECT 1;\nGO\n  go  \nSELECT 2;\nGo -- next\nSELECT 3;")).toEqual(["SELECT 1;", "SELECT 2;", "SELECT 3;"]);
  });

  it("does not split at GO inside a line", () => {
    expect(splitBatches("SELECT 'GO';\nGOTO done;")).toEqual(["SELECT 'GO';\nGOTO done;"]);
  });
});
