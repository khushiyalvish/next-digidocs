import type { RoleKey } from "@/features/access/roles";
import type { StatusKey } from "@/features/workflow/statuses";

/*
 * The workflow steps the import list can be opened at (/imports?step=…): a total and four steps of
 * old DigiDocs's dashboard (GetDashBoardCount, as D:\Khushiyal\DigidocsNext shows it), and an
 * Enterprise user's saved imports (decision log 2026-10-12). Each step is a group of workflow
 * statuses (its hint says which); `roles` are the roles whose dashboard tiles open the list at it
 * (features/dashboard/series.ts), and every status of a step is one those roles see (a unit check).
 * Since 2026-10-27 the dashboard counts its own tiles; these steps are the lists they open.
 *
 * Pure: no database, no clock.
 */

const BOTH = ["lfz_admin", "enterprise"] as const;
const REVIEWERS = ["lfz_admin", "enterprise", "nepza"] as const;
const EVERYONE = ["lfz_admin", "enterprise", "nepza", "account"] as const;

export const DASHBOARD_CARDS = [
  {
    key: "total",
    label: "Total Count",
    hint: "All submitted imports",
    roles: BOTH,
    statuses: ["submitted", "lfz_saved", "lfz_approved", "lfz_rejected", "nepza_saved", "nepza_approved", "nepza_rejected", "nepza_letter_rejected", "completed"],
  },
  { key: "saved", label: "Saved Transactions", hint: "Saved, not yet submitted", roles: ["enterprise"], statuses: ["draft"] },
  {
    key: "pending-lfz",
    label: "Pending from LFZ",
    hint: "Submitted, saved by LFTZ or rejected by NEPZA",
    roles: BOTH,
    statuses: ["submitted", "lfz_saved", "nepza_rejected"],
  },
  { key: "pending-nepza", label: "Pending from NEPZA", hint: "Approved by LFTZ or saved by NEPZA", roles: REVIEWERS, statuses: ["lfz_approved", "nepza_saved"] },
  { key: "approval-lftz", label: "Approval pending from LFTZ", hint: "Approved by NEPZA", roles: EVERYONE, statuses: ["nepza_approved"] },
  { key: "completed", label: "Process Completed", hint: "Fully processed", roles: EVERYONE, statuses: ["completed"] },
] as const satisfies readonly {
  key: string;
  label: string;
  hint: string;
  roles: readonly RoleKey[];
  statuses: readonly StatusKey[];
}[];

export type DashboardCard = (typeof DASHBOARD_CARDS)[number];
export type CardKey = DashboardCard["key"];

export const CARD_KEYS = DASHBOARD_CARDS.map((card) => card.key) as [CardKey, ...CardKey[]];

/** A card's step: its label and statuses. */
export function dashboardCard(key: CardKey) {
  return DASHBOARD_CARDS.find((card) => card.key === key)!;
}
