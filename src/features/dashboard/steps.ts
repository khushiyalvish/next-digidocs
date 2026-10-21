import type { RoleKey } from "@/features/access/roles";
import type { StatusKey } from "@/features/workflow/statuses";

/*
 * The cards of the dashboard of an LFZ Admin and of an Enterprise user, who sees their own
 * organisation's counts (old DigiDocs, live version of GetDashBoardCount, as
 * D:\Khushiyal\DigidocsNext shows it): a total and four workflow steps, and for an Enterprise
 * user also their saved (not yet submitted) imports, which an LFZ Admin never sees (decision log
 * 2026-10-12). Each step is a group of workflow statuses (its hint says which); a card opens the
 * import list at its step (/imports?step=…). features/imports/queries.ts counts imports per
 * status; `cardCounts` adds them up per card.
 *
 * Pure: no database, no clock.
 */

const BOTH = ["lfz_admin", "enterprise"] as const;

export const DASHBOARD_CARDS = [
  {
    key: "total",
    label: "Total Count",
    hint: "All submitted imports",
    color: "primary",
    roles: BOTH,
    statuses: ["submitted", "lfz_saved", "lfz_approved", "lfz_rejected", "nepza_saved", "nepza_approved", "nepza_rejected", "nepza_letter_rejected", "completed"],
  },
  { key: "saved", label: "Saved Transactions", hint: "Saved, not yet submitted", color: "neutral", roles: ["enterprise"], statuses: ["draft"] },
  {
    key: "pending-lfz",
    label: "Pending from LFZ",
    hint: "Submitted, saved by LFTZ or rejected by NEPZA",
    color: "warning",
    roles: BOTH,
    statuses: ["submitted", "lfz_saved", "nepza_rejected"],
  },
  { key: "pending-nepza", label: "Pending from NEPZA", hint: "Approved by LFTZ or saved by NEPZA", color: "chart-1", roles: BOTH, statuses: ["lfz_approved", "nepza_saved"] },
  { key: "approval-lftz", label: "Approval pending from LFTZ", hint: "Approved by NEPZA", color: "accent", roles: BOTH, statuses: ["nepza_approved"] },
  { key: "completed", label: "Process Completed", hint: "Fully processed", color: "success", roles: BOTH, statuses: ["completed"] },
] as const satisfies readonly {
  key: string;
  label: string;
  hint: string;
  color: string;
  roles: readonly RoleKey[];
  statuses: readonly StatusKey[];
}[];

export type DashboardCard = (typeof DASHBOARD_CARDS)[number];
export type CardKey = DashboardCard["key"];
export type CardCounts = Record<CardKey, number>;

export const CARD_KEYS = DASHBOARD_CARDS.map((card) => card.key) as [CardKey, ...CardKey[]];

/** A card's step: its label and statuses. */
export function dashboardCard(key: CardKey) {
  return DASHBOARD_CARDS.find((card) => card.key === key)!;
}

/** The cards a role's dashboard shows, in order. */
export function dashboardCardsFor(role: RoleKey): DashboardCard[] {
  return DASHBOARD_CARDS.filter((card) => (card.roles as readonly RoleKey[]).includes(role));
}

/** Each card's count: the sum of its statuses' counts (a status with no imports counts 0). */
export function cardCounts(byStatus: Partial<Record<StatusKey, number>>): CardCounts {
  return Object.fromEntries(
    DASHBOARD_CARDS.map((card) => [card.key, card.statuses.reduce((sum: number, status: StatusKey) => sum + (byStatus[status] ?? 0), 0)]),
  ) as CardCounts;
}
