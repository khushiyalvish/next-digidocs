import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_KEYS, ROLES } from "@/features/access/roles";
import { createOrganisationSchema, organisationListFilterSchema } from "@/features/organisations/schemas";
import { userAccessSchema, userListFilterSchema } from "@/features/users/schemas";

/* Pins who may hold which role, and how organisations are entered (ARCHITECTURE.md §6). */

const USER = "0a000000-0000-4000-8000-000000000001";
const ORG = "0b000000-0000-4000-8000-000000000002";

describe("roles (features/access/roles.ts)", () => {
  it("are the same keys the database accepts (0002_access.sql CHECK)", () => {
    const sql = readFileSync(join(process.cwd(), "database", "migrations", "0002_access.sql"), "utf8");
    const check = /ck_user_accounts_role_key CHECK \(role_key IN \(([^)]*)\)\)/.exec(sql)?.[1] ?? "";
    const keys = [...check.matchAll(/''(\w+)''/g)].map((match) => match[1]);
    expect(keys).toEqual([...ROLE_KEYS]);
  });

  it("only an Enterprise user belongs to an organisation", () => {
    expect(ROLE_KEYS.filter((key) => ROLES[key].needsOrganisation)).toEqual(["enterprise"]);
  });
});

describe("assigning access (features/users/schemas.ts)", () => {
  it("requires an organisation for an Enterprise user", () => {
    const result = userAccessSchema.safeParse({ userId: USER, role: "enterprise", organisationId: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["organisationId"]);
  });

  it("drops the organisation for every other role, and for no role", () => {
    for (const role of ["lfz_admin", "nepza", "nis", "account", ""]) {
      const result = userAccessSchema.parse({ userId: USER, role, organisationId: ORG, isActive: "on" });
      expect(result.organisationId, role).toBeNull();
    }
  });

  it("reads 'No access yet' as no role, and refuses an unknown role", () => {
    expect(userAccessSchema.parse({ userId: USER, role: "" }).role).toBeNull();
    expect(userAccessSchema.safeParse({ userId: USER, role: "owner" }).success).toBe(false);
  });

  it("accepts a phone number and refuses anything else", () => {
    expect(userAccessSchema.parse({ userId: USER, role: "", mobileNumber: "+234 (0) 801-234-5678" }).mobileNumber).toBe(
      "+234 (0) 801-234-5678",
    );
    expect(userAccessSchema.safeParse({ userId: USER, role: "", mobileNumber: "call me" }).success).toBe(false);
  });

  it("lower-cases ids and treats an unticked Active box as deactivated", () => {
    const result = userAccessSchema.parse({ userId: USER.toUpperCase(), role: "enterprise", organisationId: ORG.toUpperCase() });
    expect(result.userId).toBe(USER);
    expect(result.organisationId).toBe(ORG);
    expect(result.isActive).toBe(false);
  });
});

describe("organisations (features/organisations/schemas.ts)", () => {
  it("upper-cases the short code and turns empty optional fields into null", () => {
    const result = createOrganisationSchema.parse({ companyName: " Acme LFZ Enterprise ", shortCode: "acme", registrationDate: "" });
    expect(result).toMatchObject({ companyName: "Acme LFZ Enterprise", shortCode: "ACME", registrationDate: null, licenceNumber: null });
  });

  it("accepts a date from a date input and refuses anything else", () => {
    expect(createOrganisationSchema.parse({ companyName: "A", shortCode: "A", licenceExpiresOn: "2026-12-31" }).licenceExpiresOn).toBe(
      "2026-12-31",
    );
    expect(createOrganisationSchema.safeParse({ companyName: "A", shortCode: "A", licenceExpiresOn: "31/12/2026" }).success).toBe(false);
  });
});

describe("list filters", () => {
  it("fall back to no filter for anything malformed", () => {
    expect(userListFilterSchema.parse({ role: "owner", status: "x", page: "-3" })).toEqual({ page: 1 });
    expect(organisationListFilterSchema.parse({ status: "gone", page: "abc" })).toEqual({ page: 1 });
  });
});
