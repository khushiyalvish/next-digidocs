import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_KEYS, type RoleKey } from "@/features/access/roles";
import { DASHBOARD_CARDS } from "@/features/dashboard/steps";
import type { Member } from "@/features/auth/guards";
import { rowActions, statusesAllowing } from "@/features/workflow/actions";
import { listFilterSchema, listScope } from "@/features/workflow/list";
import { listableStatuses, STATUS_KEYS, VISIBLE_STATUSES, type StatusKey } from "@/features/workflow/statuses";

/* Pins the workflow statuses (features/workflow/statuses.ts) and the import/export list filters. */

const migration = readFileSync(join(process.cwd(), "database", "migrations", "0007_imports_exports.sql"), "utf8");

// Old M_WorkFlowStatus ids per status (10 and 11 are both "Process Completed").
const OLD_IDS: Record<StatusKey, number[]> = {
  draft: [2],
  enterprise_submitted: [12],
  submitted: [3],
  lfz_saved: [4],
  lfz_approved: [5],
  lfz_rejected: [6],
  nepza_saved: [7],
  nepza_approved: [8],
  nepza_rejected: [9],
  nepza_letter_rejected: [13],
  completed: [10, 11],
};

// Old ImpExp_G's WHERE for staff (role ids 1 LFZ Admin, 3 NEPZA, 5 Account), without the creator's own rows.
const OLD_VISIBLE: Partial<Record<RoleKey, (id: number) => boolean>> = {
  lfz_admin: (id) => id > 2 && ![2, 7].includes(id),
  nepza: (id) => id > 4 && ![2, 4, 6].includes(id),
  account: (id) => id > 7 && ![2, 4, 7, 6, 9].includes(id),
};

describe("workflow statuses", () => {
  it("are the keys the migration's CHECKs allow, on both tables", () => {
    for (const table of ["imports", "exports"]) {
      const check = migration.match(new RegExp(`ck_${table}_status_key CHECK \\(status_key IN \\(([^)]*)\\)`))?.[1];
      expect(check, table).toBeDefined();
      const keys = [...check!.matchAll(/'(\w+)'/g)].map((match) => match[1]);
      expect(keys, table).toEqual([...STATUS_KEYS]);
    }
  });

  it("keep imports and exports apart: each table only takes transaction types of its own direction", () => {
    for (const [table, direction] of [["imports", "import"], ["exports", "export"]]) {
      expect(migration, table).toContain(`CONSTRAINT ck_${table}_transaction_direction CHECK (transaction_direction = '${direction}')`);
      expect(migration.replace(/\s+/g, " "), table).toContain(
        `fk_${table}_transaction_type FOREIGN KEY (transaction_type_id, transaction_direction) REFERENCES dbo.transaction_types (id, direction)`,
      );
    }
  });

  it("cover every old status id once", () => {
    expect(Object.keys(OLD_IDS)).toEqual([...STATUS_KEYS]);
    expect(Object.values(OLD_IDS).flat().sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it("show staff what old ImpExp_G showed, except Enterprise Submit (the enterprise's own step) and Saved by NEPZA for LFTZ (the dashboard counts it)", () => {
    for (const [role, oldRule] of Object.entries(OLD_VISIBLE) as [RoleKey, (id: number) => boolean][]) {
      const expected = STATUS_KEYS.filter(
        (status) => status !== "enterprise_submitted" && (OLD_IDS[status].some(oldRule) || (role === "lfz_admin" && status === "nepza_saved")),
      );
      expect(VISIBLE_STATUSES[role], role).toEqual(expected);
    }
    expect(VISIBLE_STATUSES.enterprise).toEqual(STATUS_KEYS);
    expect(VISIBLE_STATUSES.nis).toEqual([]);
    for (const role of ROLE_KEYS) {
      if (role !== "enterprise") expect(VISIBLE_STATUSES[role], role).not.toContain("draft");
    }
  });

  it("narrow a list by the chosen status and dashboard step, never past what the role sees", () => {
    expect(listableStatuses("account", {})).toEqual(["nepza_approved", "nepza_letter_rejected", "completed"]);
    expect(listableStatuses("lfz_admin", { status: "completed" })).toEqual(["completed"]);
    expect(listableStatuses("account", { status: "submitted" })).toEqual([]);
    expect(listableStatuses("nepza", { stepStatuses: ["submitted", "lfz_saved", "nepza_rejected"] })).toEqual(["nepza_rejected"]);
    expect(listableStatuses("nis", {})).toEqual([]);
  });

  it("give every dashboard card statuses that each of its roles sees", () => {
    for (const card of DASHBOARD_CARDS) {
      expect(card.statuses.length, card.key).toBeGreaterThan(0);
      for (const role of card.roles)
        for (const status of card.statuses) expect(VISIBLE_STATUSES[role], `${card.key} → ${role} → ${status}`).toContain(status);
    }
  });
});

describe("import and export list filters", () => {
  it("read the address bar, ignoring anything malformed", () => {
    expect(listFilterSchema.parse({})).toEqual({ page: 1 });
    expect(listFilterSchema.parse({ status: "nope", step: "x", type: "1", enterprise: "y", page: "-3" })).toEqual({ page: 1 });
    const id = "0A000000-0000-4000-8000-000000000001";
    expect(listFilterSchema.parse({ q: "  LFZ ", status: "completed", step: "pending-lfz", type: id, page: "2" })).toEqual({
      q: "LFZ",
      status: "completed",
      step: "pending-lfz",
      type: id.toLowerCase(),
      page: 2,
    });
  });
});

describe("list and dashboard scope", () => {
  const member = (role: RoleKey, organisationId: string | null = null): Member => ({
    id: "u1",
    sessionId: "s1",
    email: "person@example.com",
    fullName: "A Person",
    role,
    organisationId,
    organisationName: null,
  });

  it("holds an Enterprise user to their own organisation, whatever the enterprise filter says", () => {
    const scope = listScope(member("enterprise", "org-a"), { enterprise: "org-b", page: 1 });
    expect(scope.organisationId).toBe("org-a");
    expect(scope.nothing).toBe(false);
  });

  it("gives an Enterprise user without an organisation nothing", () => {
    expect(listScope(member("enterprise"), { page: 1 }).nothing).toBe(true);
  });

  it("lets an LFZ Admin filter by enterprise, or see all", () => {
    expect(listScope(member("lfz_admin"), { enterprise: "org-b", page: 1 }).organisationId).toBe("org-b");
    expect(listScope(member("lfz_admin"), { page: 1 }).organisationId).toBeNull();
  });
});

describe("row actions (old ListImpExp / ListExp, the Action column)", () => {
  // The old views' rules, written with the old status ids, per kind and role.
  const OLD: Record<"import" | "export", Partial<Record<RoleKey, (id: number) => string[]>>> = {
    import: {
      enterprise: (id) => (id === 12 ? ["edit", "view", "delete"] : [2, 6].includes(id) ? ["edit", "delete"] : [3, 4, 5, 7, 8, 9, 10, 11, 13].includes(id) ? ["view"] : []),
      lfz_admin: (id) => ([3, 4, 5, 6, 7, 8, 9, 10, 11, 13].includes(id) ? ["view"] : []),
      nepza: (id) => ([5, 7, 8, 9, 10, 13].includes(id) ? ["view"] : []),
      account: (id) => ([8, 9, 10].includes(id) ? ["view"] : []),
    },
    export: {
      enterprise: (id) => ([2, 6].includes(id) ? ["edit", "delete"] : [3, 4, 5, 7, 8, 9, 10, 11].includes(id) ? ["view"] : []),
      lfz_admin: (id) => ([3, 4, 5, 6, 7, 8, 9, 10, 11].includes(id) ? ["view"] : []),
      nepza: (id) => ([5, 7, 8, 11].includes(id) ? ["view"] : []),
    },
  };

  it("offer what the old lists offered, for every kind, role and status", () => {
    for (const kind of ["import", "export"] as const) {
      for (const role of ROLE_KEYS) {
        for (const status of STATUS_KEYS) {
          const old = OLD[kind][role];
          const expected = old ? [...new Set(OLD_IDS[status].flatMap(old))].sort() : [];
          expect([...rowActions(kind, role, status)].sort(), `${kind} ${role} ${status}`).toEqual(expected);
        }
      }
    }
  });

  it("let only an Enterprise user edit or delete", () => {
    for (const kind of ["import", "export"] as const) {
      for (const role of ROLE_KEYS.filter((each) => each !== "enterprise")) {
        expect(statusesAllowing(kind, role, "edit"), `${kind} ${role}`).toEqual([]);
        expect(statusesAllowing(kind, role, "delete"), `${kind} ${role}`).toEqual([]);
      }
    }
    expect(statusesAllowing("import", "enterprise", "delete").sort()).toEqual(["draft", "enterprise_submitted", "lfz_rejected"]);
    expect(statusesAllowing("export", "enterprise", "delete").sort()).toEqual(["draft", "lfz_rejected"]);
  });
});

describe("migration 0008 (hidden imports and exports)", () => {
  const sql = readFileSync(join(process.cwd(), "database", "migrations", "0008_hidden_submissions.sql"), "utf8");

  it("adds deleted_at and deleted_by_account_id to both tables, and frees a hidden record's tracking number", () => {
    for (const table of ["imports", "exports"]) {
      expect(sql).toContain(`ALTER TABLE dbo.${table} ADD deleted_at DATETIMEOFFSET NULL;`);
      expect(sql).toContain(`ALTER TABLE dbo.${table} ADD deleted_by_account_id UNIQUEIDENTIFIER NULL`);
      expect(sql).toMatch(new RegExp(`CREATE UNIQUE INDEX ux_${table}_tracking_number[\\s\\S]*?deleted_at IS NULL`));
    }
  });

  it("is left out of every list, count and single read", () => {
    for (const file of ["imports", "exports"]) {
      const source = readFileSync(join(process.cwd(), "src", "features", file, "queries.ts"), "utf8");
      const reads = source.match(/(?:FROM|JOIN) dbo\.(imports|exports)\b/g) ?? [];
      const hidden = source.match(/deleted_at IS NULL/g) ?? [];
      expect(hidden.length, file).toBe(reads.length);
    }
  });
});
