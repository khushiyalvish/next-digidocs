import type { RoleKey } from "@/features/access/roles";
import type { StatusKey } from "@/features/workflow/statuses";

/*
 * What each row of the import and export lists offers — View, Edit, Delete — by role and status,
 * as old DigiDocs's list views decided it (Views/ImpExp/ListImpExp.cshtml and ListExp.cshtml, the
 * "Action" column). The view, edit and delete pages and the delete action check the same rule, so
 * a link that is not shown cannot be used either.
 *
 * Old ids → keys: 2 draft, 3 submitted, 4 lfz_saved, 5 lfz_approved, 6 lfz_rejected, 7 nepza_saved,
 * 8 nepza_approved, 9 nepza_rejected, 10/11 completed, 12 enterprise_submitted,
 * 13 nepza_letter_rejected. A status a role does not see in the list (VISIBLE_STATUSES) offers
 * nothing, whatever this table says.
 *
 * Pure: no database, no session.
 */

export type RowAction = "view" | "edit" | "delete";
export type SubmissionKind = "import" | "export";

type Rules = Partial<Record<RoleKey, Partial<Record<StatusKey, readonly RowAction[]>>>>;

const VIEW = ["view"] as const;
const EDIT_DELETE = ["edit", "delete"] as const;

/** Every status in the list, each with the same actions. */
function each(statuses: readonly StatusKey[], actions: readonly RowAction[]): Partial<Record<StatusKey, readonly RowAction[]>> {
  return Object.fromEntries(statuses.map((status) => [status, actions]));
}

const IMPORT_RULES: Rules = {
  enterprise: {
    // 12: Edit, View (to attach the enterprise cover letter), Delete.
    enterprise_submitted: ["edit", "view", "delete"],
    // 2 and 6: Edit, Delete.
    ...each(["draft", "lfz_rejected"], EDIT_DELETE),
    // 3, 4, 5, 7, 8, 9, 10, 11, 13: View.
    ...each(["submitted", "lfz_saved", "lfz_approved", "nepza_saved", "nepza_approved", "nepza_rejected", "completed", "nepza_letter_rejected"], VIEW),
  },
  // 3-11 and 13: View (on 3, 4 and 9 to attach the LFZ cover letter).
  lfz_admin: each(
    ["submitted", "lfz_saved", "lfz_approved", "lfz_rejected", "nepza_saved", "nepza_approved", "nepza_rejected", "completed", "nepza_letter_rejected"],
    VIEW,
  ),
  // 5, 7, 8, 9, 10, 13: View.
  nepza: each(["lfz_approved", "nepza_saved", "nepza_approved", "nepza_rejected", "completed", "nepza_letter_rejected"], VIEW),
  // 8, 9, 10: View.
  account: each(["nepza_approved", "nepza_rejected", "completed"], VIEW),
};

const EXPORT_RULES: Rules = {
  enterprise: {
    // 2 and 6: Edit, Delete.
    ...each(["draft", "lfz_rejected"], EDIT_DELETE),
    // 3, 4, 5, 7, 8, 9, 10, 11: View.
    ...each(["submitted", "lfz_saved", "lfz_approved", "nepza_saved", "nepza_approved", "nepza_rejected", "completed"], VIEW),
  },
  // 3-11: View.
  lfz_admin: each(["submitted", "lfz_saved", "lfz_approved", "lfz_rejected", "nepza_saved", "nepza_approved", "nepza_rejected", "completed"], VIEW),
  // 5, 7, 8, 11: View.
  nepza: each(["lfz_approved", "nepza_saved", "nepza_approved", "completed"], VIEW),
};

/** The actions a row offers, in the order the list shows them. */
export function rowActions(kind: SubmissionKind, role: RoleKey, status: StatusKey): readonly RowAction[] {
  const actions = (kind === "import" ? IMPORT_RULES : EXPORT_RULES)[role]?.[status] ?? [];
  return (["view", "edit", "delete"] as const).filter((action) => actions.includes(action));
}

export function canDo(kind: SubmissionKind, role: RoleKey, status: StatusKey, action: RowAction): boolean {
  return rowActions(kind, role, status).includes(action);
}

/** The statuses in which a role may do an action: what the delete statement is held to. */
export function statusesAllowing(kind: SubmissionKind, role: RoleKey, action: RowAction): StatusKey[] {
  const rules = (kind === "import" ? IMPORT_RULES : EXPORT_RULES)[role] ?? {};
  return (Object.keys(rules) as StatusKey[]).filter((status) => canDo(kind, role, status, action));
}
