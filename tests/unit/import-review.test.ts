import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_KEYS } from "@/features/access/roles";
import { canDo } from "@/features/workflow/actions";
import { reviewStep, reviewSteps } from "@/features/workflow/review";
import { STATUS_KEYS, VISIBLE_STATUSES } from "@/features/workflow/statuses";

/* Pins the approval process (src/features/workflow/review.ts) against old ViewImpExp / UpdateApplicantStatus. */

const summary = (role: (typeof ROLE_KEYS)[number], status: (typeof STATUS_KEYS)[number]) =>
  reviewSteps(role, status).map((step) => `${step.decision}→${step.to}${step.letter ? `+${step.letter}` : ""}${step.reasonRequired ? "+reason" : ""}`);

describe("who may take which step", () => {
  it("LFZ Admin approves with the LFZ Letter or rejects with a reason, at Submitted / Saved by LFTZ / Rejected by NEPZA", () => {
    for (const status of ["submitted", "lfz_saved", "nepza_rejected"] as const) {
      expect(summary("lfz_admin", status)).toEqual(["reject→lfz_rejected+reason", "approve→lfz_approved+lfz_letter"]);
    }
  });

  it("NEPZA approves with the NEPZA Letter or rejects with a reason, at Approved by LFTZ / Saved by NEPZA", () => {
    for (const status of ["lfz_approved", "nepza_saved"] as const) {
      expect(summary("nepza", status)).toEqual(["reject→nepza_rejected+reason", "approve→nepza_approved+nepza_letter"]);
    }
  });

  it("LFZ Admin gives final approval with the Approval Letter, or rejects the NEPZA Letter, at Approved by NEPZA", () => {
    expect(summary("lfz_admin", "nepza_approved")).toEqual(["reject_nepza_letter→nepza_letter_rejected+reason", "final_approve→completed+lfz_approval_letter"]);
  });

  it("NEPZA re-submits a new letter after its letter was rejected", () => {
    expect(summary("nepza", "nepza_letter_rejected")).toEqual(["resubmit_nepza_letter→nepza_approved+nepza_letter"]);
  });

  it("offers nothing else to anyone", () => {
    const offered = new Set(["lfz_admin:submitted", "lfz_admin:lfz_saved", "lfz_admin:nepza_rejected", "lfz_admin:nepza_approved", "nepza:lfz_approved", "nepza:nepza_saved", "nepza:nepza_letter_rejected"]);
    for (const role of ROLE_KEYS) {
      for (const status of STATUS_KEYS) {
        if (!offered.has(`${role}:${status}`)) expect(reviewSteps(role, status), `${role} ${status}`).toEqual([]);
      }
    }
  });

  it("refuses a step taken from another status (the import moved on)", () => {
    expect(reviewStep("lfz_admin", "submitted", "final_approve")).toBeNull();
    expect(reviewStep("nepza", "submitted", "approve")).toBeNull();
    expect(reviewStep("lfz_admin", "completed", "approve")).toBeNull();
  });
});

describe("the steps fit the lists", () => {
  it("are offered only on imports the role sees in its list, and can open on its View page", () => {
    for (const role of ROLE_KEYS) {
      for (const status of STATUS_KEYS) {
        if (reviewSteps(role, status).length === 0) continue;
        expect(VISIBLE_STATUSES[role], `${role} ${status}`).toContain(status);
        expect(canDo("import", role, status, "view"), `${role} ${status}`).toBe(true);
      }
    }
  });

  it("lead where the next party sees them: LFZ's approval to NEPZA, NEPZA's to LFZ, rejections back", () => {
    expect(VISIBLE_STATUSES.nepza).toContain(reviewStep("lfz_admin", "submitted", "approve")!.to);
    expect(VISIBLE_STATUSES.lfz_admin).toContain(reviewStep("nepza", "lfz_approved", "approve")!.to);
    expect(VISIBLE_STATUSES.lfz_admin).toContain(reviewStep("nepza", "lfz_approved", "reject")!.to);
    expect(VISIBLE_STATUSES.nepza).toContain(reviewStep("lfz_admin", "nepza_approved", "reject_nepza_letter")!.to);
    expect(canDo("import", "enterprise", reviewStep("lfz_admin", "submitted", "reject")!.to, "edit")).toBe(true);
  });
});

describe("migration 0015", () => {
  const sql = readFileSync(join(process.cwd(), "database", "migrations", "0015_import_review.sql"), "utf8");

  it("adds the timeline and lets letters be uploads without a document type", () => {
    expect(sql).toContain("CREATE TABLE dbo.import_status_history");
    expect(sql).toContain("purpose IN ('duty_paid', 'lfz_letter', 'nepza_letter', 'lfz_approval_letter') AND document_type_id IS NULL");
    for (const decision of ["created", "submitted", "approve", "reject", "final_approve", "reject_nepza_letter", "resubmit_nepza_letter"]) {
      expect(sql).toContain(`'${decision}'`);
    }
  });
});
