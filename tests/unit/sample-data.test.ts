import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { testUsersFileSchema } from "@/lib/test-users";
import { appTestUserSchema } from "@/features/auth/schemas";
import { reviewStep } from "@/features/workflow/review";
import type { StatusKey } from "@/features/workflow/statuses";
import { SAMPLE_DATA_FILE, SAMPLE_PATHS, SAMPLE_STATUSES, sampleDataFileSchema } from "@/features/sample-data/schemas";

/*
 * Pins database/seed/sample-data.json (hub CHILD-APP-GUIDE.md §5.10): it parses, every record is
 * owned by an Enterprise user of the test team, every status the workflow reaches has a sample for
 * each of them, and every path is one the workflow allows.
 */

const raw = JSON.parse(readFileSync(SAMPLE_DATA_FILE, "utf8"));
const parsed = sampleDataFileSchema.safeParse(raw);
const samples = parsed.success ? parsed.data.imports : [];
const users = testUsersFileSchema(appTestUserSchema, ["oneportal.test", "edgeaxis.in"]).parse(
  JSON.parse(readFileSync("database/seed/test-users.json", "utf8")),
).users;

describe("database/seed/sample-data.json", () => {
  it("parses (SAMPLE-NNNN tracking numbers used once, known shipments, reasons only on rejections, no step in the future)", () => {
    expect(parsed.success, parsed.success ? "" : parsed.error.message).toBe(true);
  });

  it("is owned by Enterprise users in test-users.json", () => {
    for (const sample of samples) {
      const owner = users.find((user) => user.id === sample.ownerId);
      expect(owner?.role, sample.trackingNumber).toBe("enterprise");
    }
  });

  it("has every reachable status for every Enterprise user it names, within the last 90 days", () => {
    const owners = new Set(samples.map((sample) => sample.ownerId));
    expect(owners.size).toBeGreaterThanOrEqual(2);
    for (const owner of owners) {
      for (const status of SAMPLE_STATUSES) {
        expect(samples.some((sample) => sample.ownerId === owner && sample.status === status), `${owner} ${status}`).toBe(true);
      }
    }
    for (const sample of samples) expect(sample.daysAgo).toBeLessThanOrEqual(90);
  });

  it("names somebody in test-users.json for every reviewing role", () => {
    for (const review of Object.values(SAMPLE_PATHS).flat()) {
      expect(users.some((user) => user.role === review.role), review.role).toBe(true);
    }
  });

  it("refuses a duplicate tracking number, a reason on an approval, and a missing reason on a rejection", () => {
    const sample = { trackingNumber: "SAMPLE-0001", ownerId: users[0].id, shipment: Object.keys(raw.shipments)[0], status: "submitted", daysAgo: 5, reason: null };
    expect(sampleDataFileSchema.safeParse({ ...raw, imports: [sample, sample] }).success).toBe(false);
    expect(sampleDataFileSchema.safeParse({ ...raw, imports: [{ ...sample, reason: "No" }] }).success).toBe(false);
    expect(sampleDataFileSchema.safeParse({ ...raw, imports: [{ ...sample, status: "lfz_rejected" }] }).success).toBe(false);
    expect(sampleDataFileSchema.safeParse({ ...raw, imports: [{ ...sample, trackingNumber: "LPLELTD/IMP/20261000001" }] }).success).toBe(false);
  });
});

describe("sample paths (features/sample-data/schemas.ts)", () => {
  it("take an import from Submitted to its status through steps the workflow offers", () => {
    for (const status of SAMPLE_STATUSES) {
      if (status === "draft") continue;
      let current: StatusKey = "submitted";
      for (const review of SAMPLE_PATHS[status]) {
        const step = reviewStep(review.role, current, review.decision);
        expect(step, `${status}: ${review.role} ${review.decision} at ${current}`).not.toBeNull();
        current = step!.to;
      }
      expect(current).toBe(status);
    }
  });
});
