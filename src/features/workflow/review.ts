import type { RoleKey } from "@/features/access/roles";
import type { StatusKey } from "@/features/workflow/statuses";

/*
 * The approval process of an import (old ViewImpExp action buttons, UpdateApplicantStatus and
 * EnterpriseLetter; decision log 2026-10-19). Which steps a role may take at a status, where each
 * step leads, whether it needs a letter and whether it needs a reason:
 *
 *   LFZ Admin  Submitted to LFTZ / Saved by LFTZ / Rejected by NEPZA
 *                Approve (LFZ Letter)            → Approved by LFTZ
 *                Reject (reason)                 → Rejected by LFTZ (the enterprise may edit and resubmit)
 *   NEPZA      Approved by LFTZ / Saved by NEPZA
 *                Approve (NEPZA Letter)          → Approved by NEPZA
 *                Reject (reason)                 → Rejected by NEPZA (back to LFZ)
 *   LFZ Admin  Approved by NEPZA
 *                Final Approve (Approval Letter) → Process Completed
 *                Reject NEPZA Letter (reason)    → Rejected Nepza Letter
 *   NEPZA      Rejected Nepza Letter
 *                Re-submit (new NEPZA Letter)    → Approved by NEPZA
 *
 * The page offers only these steps, and the server takes a step only from the status it was
 * offered at (one conditional UPDATE), so two officers acting at once cannot both move it.
 *
 * Pure: no database, no session.
 */

export const LETTER_KINDS = {
  lfz_letter: "LFZ Letter",
  nepza_letter: "NEPZA Letter",
  lfz_approval_letter: "LFZ Approval Letter",
} as const;
export type LetterKind = keyof typeof LETTER_KINDS;

export const REVIEW_DECISIONS = ["approve", "reject", "final_approve", "reject_nepza_letter", "resubmit_nepza_letter"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export interface ReviewStep {
  decision: ReviewDecision;
  /** The button and the popup's confirm button. */
  label: string;
  /** The popup's title and question. */
  title: string;
  question: string;
  to: StatusKey;
  /** The letter that must be uploaded with the step; null: none. */
  letter: LetterKind | null;
  /** A rejection needs a reason, which the enterprise or LFZ sees. */
  reasonRequired: boolean;
  tone: "confirm" | "danger";
}

const LFZ_APPROVE: ReviewStep = {
  decision: "approve",
  label: "Approve",
  title: "Approve this import?",
  question: "Upload the LFZ Letter. The import goes to NEPZA.",
  to: "lfz_approved",
  letter: "lfz_letter",
  reasonRequired: false,
  tone: "confirm",
};
const LFZ_REJECT: ReviewStep = {
  decision: "reject",
  label: "Reject",
  title: "Reject this import?",
  question: "It goes back to the enterprise, who sees your reason and may correct and resubmit it.",
  to: "lfz_rejected",
  letter: null,
  reasonRequired: true,
  tone: "danger",
};
const NEPZA_APPROVE: ReviewStep = {
  decision: "approve",
  label: "Approve",
  title: "Approve this import?",
  question: "Upload the NEPZA Letter. The import goes back to LFZ for final approval.",
  to: "nepza_approved",
  letter: "nepza_letter",
  reasonRequired: false,
  tone: "confirm",
};
const NEPZA_REJECT: ReviewStep = {
  decision: "reject",
  label: "Reject",
  title: "Reject this import?",
  question: "It goes back to LFZ, who sees your reason.",
  to: "nepza_rejected",
  letter: null,
  reasonRequired: true,
  tone: "danger",
};
const FINAL_APPROVE: ReviewStep = {
  decision: "final_approve",
  label: "LFZ Final Approve",
  title: "Give final approval?",
  question: "Upload the LFZ Approval Letter. The import is then complete.",
  to: "completed",
  letter: "lfz_approval_letter",
  reasonRequired: false,
  tone: "confirm",
};
const REJECT_NEPZA_LETTER: ReviewStep = {
  decision: "reject_nepza_letter",
  label: "Reject NEPZA Letter",
  title: "Reject the NEPZA Letter?",
  question: "NEPZA sees your reason and uploads a new letter.",
  to: "nepza_letter_rejected",
  letter: null,
  reasonRequired: true,
  tone: "danger",
};
const RESUBMIT_NEPZA_LETTER: ReviewStep = {
  decision: "resubmit_nepza_letter",
  label: "Re-submit",
  title: "Re-submit the NEPZA Letter?",
  question: "Upload the new NEPZA Letter. The import goes back to LFZ for final approval.",
  to: "nepza_approved",
  letter: "nepza_letter",
  reasonRequired: false,
  tone: "confirm",
};

const STEPS: Partial<Record<RoleKey, Partial<Record<StatusKey, readonly ReviewStep[]>>>> = {
  lfz_admin: {
    submitted: [LFZ_REJECT, LFZ_APPROVE],
    lfz_saved: [LFZ_REJECT, LFZ_APPROVE],
    nepza_rejected: [LFZ_REJECT, LFZ_APPROVE],
    nepza_approved: [REJECT_NEPZA_LETTER, FINAL_APPROVE],
  },
  nepza: {
    lfz_approved: [NEPZA_REJECT, NEPZA_APPROVE],
    nepza_saved: [NEPZA_REJECT, NEPZA_APPROVE],
    nepza_letter_rejected: [RESUBMIT_NEPZA_LETTER],
  },
};

/** The steps a role may take on an import in this status (empty: none). */
export function reviewSteps(role: RoleKey, status: StatusKey): readonly ReviewStep[] {
  return STEPS[role]?.[status] ?? [];
}

export function reviewStep(role: RoleKey, status: StatusKey, decision: ReviewDecision): ReviewStep | null {
  return reviewSteps(role, status).find((step) => step.decision === decision) ?? null;
}

export const MAX_REASON_LENGTH = 2500;

/** What the timeline says about a step. */
export const DECISION_LABELS: Record<ReviewDecision | "created" | "submitted", string> = {
  created: "Started",
  submitted: "Submitted to LFTZ",
  approve: "Approved",
  reject: "Rejected",
  final_approve: "Final approval",
  reject_nepza_letter: "NEPZA Letter rejected",
  resubmit_nepza_letter: "NEPZA Letter re-submitted",
};
