import type { RoleKey } from "@/features/access/roles";
import type { Tone } from "@/components/ui/primitives";

/*
 * The workflow statuses of an import or export (old DigiDocs: M_WorkFlowStatus, ids 2-13), in
 * workflow order. A fixed list: the keys are stored in imports.status_key and exports.status_key;
 * database/migrations/0007_imports_exports.sql has CHECKs with the same keys. Old ids 10 and 11
 * (both "Process Completed") are one status here.
 *
 * Pure: no database, no session. Never decides access by itself — the list queries apply it.
 */

export const STATUS_KEYS = [
  "draft", // 2  Saved by Enterprise
  "enterprise_submitted", // 12 Enterprise Submit: the enterprise's cover letter, before LFTZ sees it
  "submitted", // 3  Submitted to LFTZ
  "lfz_saved", // 4  Saved by LFTZ
  "lfz_approved", // 5  Approved by LFTZ
  "lfz_rejected", // 6  Rejected by LFTZ
  "nepza_saved", // 7  Saved by NEPZA
  "nepza_approved", // 8  Approved by NEPZA
  "nepza_rejected", // 9  Rejected by NEPZA
  "nepza_letter_rejected", // 13 Rejected Nepza Letter
  "completed", // 10, 11 Process Completed
] as const;

export type StatusKey = (typeof STATUS_KEYS)[number];

/** The old labels, as people know them. */
export const STATUS_LABELS: Record<StatusKey, string> = {
  draft: "Saved by Enterprise",
  enterprise_submitted: "Enterprise Submit",
  submitted: "Submitted to LFTZ",
  lfz_saved: "Saved by LFTZ",
  lfz_approved: "Approved by LFTZ",
  lfz_rejected: "Rejected by LFTZ",
  nepza_saved: "Saved by NEPZA",
  nepza_approved: "Approved by NEPZA",
  nepza_rejected: "Rejected by NEPZA",
  nepza_letter_rejected: "Rejected Nepza Letter",
  completed: "Process Completed",
};

/** Red for a rejection, green when done, amber while LFTZ or NEPZA has it; the enterprise's own steps are neutral. */
export const STATUS_TONES: Record<StatusKey, Tone> = {
  draft: "neutral",
  enterprise_submitted: "neutral",
  submitted: "warning",
  lfz_saved: "warning",
  lfz_approved: "warning",
  lfz_rejected: "danger",
  nepza_saved: "warning",
  nepza_approved: "warning",
  nepza_rejected: "danger",
  nepza_letter_rejected: "danger",
  completed: "success",
};

/** Statuses whose reason the list shows as "Remarks" (old list views: ids 6, 9, 13). */
export const REJECTED_STATUSES: readonly StatusKey[] = ["lfz_rejected", "nepza_rejected", "nepza_letter_rejected"];

/**
 * Which statuses each role sees in the import and export lists (old ImpExp_G). An Enterprise
 * user sees every status of their own organisation's records (the query scopes them). The old
 * procedure also showed "Enterprise Submit" (id 12) to LFTZ, NEPZA and Account because 12 > 4;
 * it is the enterprise's own step, so here only the enterprise sees it. And it hid "Saved by
 * NEPZA" (id 7) from LFTZ, although the dashboard counts it as pending from NEPZA; an LFZ Admin
 * sees it here (decision log 2026-10-08).
 */
export const VISIBLE_STATUSES: Record<RoleKey, readonly StatusKey[]> = {
  enterprise: STATUS_KEYS,
  lfz_admin: ["submitted", "lfz_saved", "lfz_approved", "lfz_rejected", "nepza_saved", "nepza_approved", "nepza_rejected", "nepza_letter_rejected", "completed"],
  nepza: ["lfz_approved", "nepza_saved", "nepza_approved", "nepza_rejected", "nepza_letter_rejected", "completed"],
  account: ["nepza_approved", "nepza_letter_rejected", "completed"],
  nis: [],
};

/**
 * The statuses a list may show: what the role sees, narrowed by a chosen status and by a dashboard
 * step's statuses. Empty: nothing to show (the query must not run with an empty IN list).
 */
export function listableStatuses(role: RoleKey, choice: { status?: StatusKey; stepStatuses?: readonly StatusKey[] }): StatusKey[] {
  return VISIBLE_STATUSES[role].filter(
    (status) => (!choice.status || status === choice.status) && (!choice.stepStatuses || choice.stepStatuses.includes(status)),
  );
}
