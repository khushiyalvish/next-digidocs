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

/** The installation's test domains on a test installation that seeds the suite's test team. */
const TEAM_DOMAINS = ["oneportal.test", "edgeaxis.in"];

/**
 * The suite's test team, exactly as the hub's database/seed/test-users.json has them (another
 * repository, so copied here). Never change these: the hub creates the same people under the same ids.
 */
const TEST_TEAM = [
  { id: "9bcde7ab-5398-4668-a562-dc14b99314be", email: "sameer.bidi@edgeaxis.in", fullName: "Sameer Bidi" },
  { id: "280f60e7-b2fe-44df-ae29-f7c8c87192a7", email: "shaheem.shaikh@edgeaxis.in", fullName: "Shaheem Shaikh" },
  { id: "c3d6c220-a1d6-4052-a535-649e544d3c3a", email: "ismail.chaudhary@edgeaxis.in", fullName: "Ismail Chaudhary" },
  { id: "1c7d981d-3ac8-4c35-9206-9ba61ff1e564", email: "khushiyal.vishwakarma@edgeaxis.in", fullName: "Khushiyal Vishwakarma" },
];

describe("database/seed/test-users.json", () => {
  const raw = JSON.parse(readFileSync(join(process.cwd(), "database", "seed", "test-users.json"), "utf8"));
  const parsed = testUsersFileSchema(appTestUserSchema, TEAM_DOMAINS).safeParse(raw);
  const users = parsed.success ? parsed.data.users : [];

  it("parses with DigiDocs's schema and the team's domains (ids and emails unique; organisation only for Enterprise users)", () => {
    expect(parsed.success, parsed.success ? "" : parsed.error.message).toBe(true);
  });

  it("is refused where the team's domain is not a test domain (the default installation)", () => {
    expect(testUsersFileSchema(appTestUserSchema, ["oneportal.test"]).safeParse(raw).success).toBe(false);
  });

  it("holds every member of the suite's test team, as the hub's file has them", () => {
    for (const member of TEST_TEAM) {
      const user = users.find((each) => each.id === member.id);
      expect(user, member.email).toBeDefined();
      expect({ id: user?.id, email: user?.email, fullName: user?.fullName }).toEqual(member);
    }
  });

  it("gives DigiDocs's own extras an @oneportal.test address starting with its short name", () => {
    const team = new Set(TEST_TEAM.map((member) => member.id));
    for (const user of users.filter((each) => !team.has(each.id))) {
      expect(user.email.startsWith("digidocs.") && user.email.endsWith("@oneportal.test"), user.email).toBe(true);
    }
  });

  it("has a test user for every role, and one still waiting for access", () => {
    for (const role of ROLE_KEYS) expect(users.some((user) => user.role === role), role).toBe(true);
    expect(users.some((user) => user.role === null)).toBe(true);
  });

  it("has Enterprise users in two organisations, so scoping to one's own organisation can be seen", () => {
    const organisations = new Set(users.filter((user) => user.role === "enterprise").map((user) => user.organisationShortCode));
    expect(organisations.size).toBeGreaterThanOrEqual(2);
  });

  it("refuses an Enterprise user without an organisation, an organisation on any other role, and an unknown role", () => {
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

  it("clears the sample data first: it points at test users' imports", () => {
    expect(CLEAR_PARTS[0].key).toBe("sample-data");
  });

  it("selects the named parts in the order they are defined; all means every part", () => {
    expect(selectParts("sessions, Test-Users", CLEAR_PARTS).parts.map((part) => part.key)).toEqual(["test-users", "sessions"]);
    expect(selectParts("all", CLEAR_PARTS).parts).toEqual(CLEAR_PARTS);
  });
});
