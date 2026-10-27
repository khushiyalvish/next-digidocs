import { describe, expect, it } from "vitest";
import { ROLE_KEYS } from "@/features/access/roles";
import {
  attentionItems,
  byState,
  formatWait,
  OPEN_STATUSES,
  SAMPLE_ENTERPRISES,
  sampleDashboard,
  sampleWaiting,
  stageTilesFor,
  waitingForRole,
  waitingListStatuses,
  waitingOn,
  type StatusCounts,
} from "@/features/dashboard/series";
import { dashboardCard } from "@/features/dashboard/steps";
import { STATUS_KEYS, VISIBLE_STATUSES } from "@/features/workflow/statuses";

/* Pins the dashboard's pure rules (features/dashboard/series.ts): tiles, whose turn, what needs a look, sample data. */

const DAYS = ["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"];

describe("whose turn it is", () => {
  it("follows the workflow's own rules: LFZ and NEPZA where they review, the enterprise where it edits", () => {
    expect(STATUS_KEYS.map((status) => [status, waitingOn(status)])).toEqual([
      ["draft", "enterprise"],
      ["enterprise_submitted", "enterprise"],
      ["submitted", "lfz"],
      ["lfz_saved", "lfz"],
      ["lfz_approved", "nepza"],
      ["lfz_rejected", "enterprise"],
      ["nepza_saved", "nepza"],
      ["nepza_approved", "lfz"],
      ["nepza_rejected", "lfz"],
      ["nepza_letter_rejected", "nepza"],
      ["completed", null],
    ]);
  });

  it("gives each role what waits on it, and Account and NIS nothing", () => {
    expect(waitingForRole("lfz_admin")).toEqual(["submitted", "lfz_saved", "nepza_approved", "nepza_rejected"]);
    expect(waitingForRole("nepza")).toEqual(["lfz_approved", "nepza_saved", "nepza_letter_rejected"]);
    expect(waitingForRole("enterprise")).toEqual(["draft", "enterprise_submitted", "lfz_rejected"]);
    expect(waitingForRole("account")).toEqual([]);
    expect(waitingListStatuses("account")).toEqual(["nepza_approved", "nepza_letter_rejected"]);
  });
});

describe("Right now tiles", () => {
  it("count only statuses the role sees, and open the list at a step the role may use", () => {
    for (const role of ROLE_KEYS) {
      for (const tile of stageTilesFor(role)) {
        for (const status of tile.statuses) expect(VISIBLE_STATUSES[role], `${role} ${tile.key}`).toContain(status);
        if ("step" in tile.link) expect(dashboardCard(tile.link.step).roles as readonly string[], `${role} ${tile.key}`).toContain(role);
        else expect(VISIBLE_STATUSES[role]).toContain(tile.link.status);
      }
    }
  });

  it("gives every role with imports its tiles, and NIS none (it keeps its menu)", () => {
    expect(stageTilesFor("lfz_admin").map((tile) => tile.key)).toEqual(["with-lfz", "final-approval", "with-nepza", "sent-back", "letter-sent-back", "completed"]);
    expect(stageTilesFor("enterprise").map((tile) => tile.key)).toEqual(["drafts", "sent-back", "with-lfz", "with-nepza", "final-approval", "completed"]);
    expect(stageTilesFor("nepza").map((tile) => tile.key)).toEqual(["with-nepza", "letter-sent-back", "final-approval", "completed"]);
    expect(stageTilesFor("account").map((tile) => tile.key)).toEqual(["final-approval", "letter-sent-back", "completed"]);
    expect(stageTilesFor("nis")).toEqual([]);
  });
});

describe("Needs a look", () => {
  const href = (link: { step: string } | { status: string }) => ("step" in link ? `step=${link.step}` : `status=${link.status}`);

  it("is empty when nothing waits too long", () => {
    for (const role of ROLE_KEYS) expect(attentionItems(role, {}, href)).toEqual([]);
  });

  it("tells LFZ what has waited for it, most urgent first, then people waiting for a role", () => {
    const now: StatusCounts = { submitted: { total: 4, stale: 2 }, nepza_approved: { total: 1, stale: 1 }, lfz_approved: { total: 3, stale: 0 } };
    expect(attentionItems("lfz_admin", now, href, 1)).toEqual([
      { text: "2 imports have waited for LFZ review over 5 days", href: "step=pending-lfz", tone: "danger" },
      { text: "1 import has waited for final approval over 5 days", href: "step=approval-lftz", tone: "danger" },
      { text: "1 person has signed in and is waiting for a role", href: "/admin/users?status=waiting", tone: "warning" },
    ]);
  });

  it("tells an enterprise what was sent back, and NEPZA which letters to re-submit", () => {
    expect(attentionItems("enterprise", { lfz_rejected: { total: 2, stale: 0 } }, href)[0]).toEqual({
      text: "2 imports were sent back by LFTZ: correct and submit again",
      href: "status=lfz_rejected",
      tone: "danger",
    });
    expect(attentionItems("nepza", { nepza_letter_rejected: { total: 1, stale: 0 } }, href)[0].href).toBe("status=nepza_letter_rejected");
  });

  it("never counts a status the role does not see", () => {
    expect(attentionItems("nepza", { submitted: { total: 9, stale: 9 } }, href)).toEqual([]);
  });
});

describe("arithmetic", () => {
  it("splits imports into drafts, in review, sent back and completed", () => {
    expect(byState({ draft: { total: 2, stale: 0 }, submitted: { total: 3, stale: 0 }, nepza_rejected: { total: 1, stale: 0 }, completed: { total: 5, stale: 0 } })).toEqual({
      drafts: 2,
      inReview: 3,
      sentBack: 1,
      completed: 5,
    });
  });

  it("writes waiting times plainly", () => {
    expect(formatWait(0.5)).toBe("under 1 h");
    expect(formatWait(5)).toBe("5 h");
    expect(formatWait(52)).toBe("2 d 4 h");
    expect(formatWait(24 * 9 + 3)).toBe("9 days");
  });

  it("keeps OPEN_STATUSES to everything but completed", () => {
    expect(OPEN_STATUSES).not.toContain("completed");
    expect(OPEN_STATUSES.length).toBe(STATUS_KEYS.length - 1);
  });
});

describe("sample data", () => {
  it("is repeatable, one value per real day, and keeps to what the role sees", () => {
    const first = sampleDashboard(DAYS, "nepza", null);
    expect(sampleDashboard(DAYS, "nepza", null)).toEqual(first);
    expect(first.days.map((day) => day.day)).toEqual(DAYS);
    for (const status of Object.keys(first.now)) expect(VISIBLE_STATUSES.nepza).toContain(status);
    expect(first.current.submitted).toBe(first.days.reduce((sum, day) => sum + day.submitted, 0));
  });

  it("ranks made-up enterprises for the whole zone, and none for one enterprise", () => {
    expect(sampleDashboard(DAYS, "lfz_admin", null).enterprises.map((row) => row.code)).toEqual(SAMPLE_ENTERPRISES.map((enterprise) => enterprise.code));
    expect(sampleDashboard(DAYS, "enterprise", { code: "LPLELTD", share: 0.2 }).enterprises).toEqual([]);
  });

  it("lists waiting imports only in statuses the role waits on, and none of them links anywhere", () => {
    for (const row of sampleWaiting("lfz_admin", null)) {
      expect(waitingForRole("lfz_admin")).toContain(row.status);
      expect(row.id).toBeNull();
    }
    expect(sampleWaiting("nis", null)).toEqual([]);
  });
});
