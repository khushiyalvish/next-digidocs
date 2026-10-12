import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { selectParts } from "@/lib/data-clear";
import { testUsersFileSchema } from "@/lib/test-users";
import { ROLE_KEYS } from "@/features/access/roles";
import { appTestUserSchema } from "@/features/auth/schemas";
import { CLEAR_PARTS } from "@/features/maintenance/clear-parts";

/*
 * Pins database/seed/test-users.json (hub CHILD-APP-GUIDE.md §5.8) and the data:clear parts (§5.9).
 */

describe("database/seed/test-users.json", () => {
  const raw = JSON.parse(readFileSync(join(process.cwd(), "database", "seed", "test-users.json"), "utf8"));
  const parsed = testUsersFileSchema(appTestUserSchema).safeParse(raw);

  it("parses with DigiDocs's schema (test addresses only; ids and emails unique; organisation only for Enterprise users)", () => {
    expect(parsed.success, parsed.success ? "" : parsed.error.message).toBe(true);
  });

  it("starts every address with DigiDocs's short name, so no other application picks the same one", () => {
    for (const user of raw.users as { email: string }[]) {
      expect(user.email.toLowerCase().startsWith("digidocs.")).toBe(true);
    }
  });

  it("has a test user for every role, and one still waiting for access", () => {
    const users = parsed.success ? parsed.data.users : [];
    for (const role of ROLE_KEYS) expect(users.some((user) => user.role === role), role).toBe(true);
    expect(users.some((user) => user.role === null)).toBe(true);
  });

  it("has Enterprise users in two organisations, so scoping to one's own organisation can be seen", () => {
    const users = parsed.success ? parsed.data.users : [];
    const organisations = new Set(users.filter((user) => user.role === "enterprise").map((user) => user.organisationShortCode));
    expect(organisations.size).toBeGreaterThanOrEqual(2);
  });

  it("refuses an Enterprise user without an organisation, and an organisation on any other role", () => {
    const base = { id: "0a000000-0000-4000-8000-000000000001", email: "digidocs.x@oneportal.test", fullName: "X" };
    expect(appTestUserSchema.safeParse({ ...base, role: "enterprise", organisationShortCode: null }).success).toBe(false);
    expect(appTestUserSchema.safeParse({ ...base, role: "nepza", organisationShortCode: "INS" }).success).toBe(false);
    expect(appTestUserSchema.safeParse({ ...base, role: "owner", organisationShortCode: null }).success).toBe(false);
  });
});

describe("data:clear parts (features/maintenance/clear-parts.ts)", () => {
  it("no two parts share a key, and none is called all", () => {
    const keys = CLEAR_PARTS.map((part) => part.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain("all");
  });

  it("selects the named parts in the order they are defined; all means every part", () => {
    expect(selectParts("sessions, Test-Users", CLEAR_PARTS).parts.map((part) => part.key)).toEqual(["test-users", "sessions"]);
    expect(selectParts("all", CLEAR_PARTS).parts).toEqual(CLEAR_PARTS);
  });
});
