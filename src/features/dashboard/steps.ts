import type { StatusKey } from "@/features/workflow/statuses";

/*
 * The cards of the LFZ Admin dashboard (old DigiDocs, live version of GetDashBoardCount, as
 * D:\Khushiyal\DigidocsNext shows it): a total and four workflow steps. Each step is a group of
 * workflow statuses (its hint says which); a card opens the import list at its step
 * (/imports?step=…). features/imports/queries.ts counts imports per status; `cardCounts` adds
 * them up per card.
 *
 * Pure: no database, no clock.
 */

export const DASHBOARD_CARDS = [
  {
    key: "total",
    label: "Total Count",
    hint: "All submitted imports",
    color: "primary",
    statuses: ["submitted", "lfz_saved", "lfz_approved", "lfz_rejected", "nepza_saved", "nepza_approved", "nepza_rejected", "nepza_letter_rejected", "completed"],
  },
  {
    key: "pending-lfz",
    label: "Pending from LFZ",
    hint: "Submitted, saved by LFTZ or rejected by NEPZA",
    color: "warning",
    statuses: ["submitted", "lfz_saved", "nepza_rejected"],
  },
  { key: "pending-nepza", label: "Pending from NEPZA", hint: "Approved by LFTZ or saved by NEPZA", color: "chart-1", statuses: ["lfz_approved", "nepza_saved"] },
  { key: "approval-lftz", label: "Approval pending from LFTZ", hint: "Approved by NEPZA", color: "accent", statuses: ["nepza_approved"] },
  { key: "completed", label: "Process Completed", hint: "Fully processed", color: "success", statuses: ["completed"] },
] as const satisfies readonly { key: string; label: string; hint: string; color: string; statuses: readonly StatusKey[] }[];

export type CardKey = (typeof DASHBOARD_CARDS)[number]["key"];
export type CardCounts = Record<CardKey, number>;

export const CARD_KEYS = DASHBOARD_CARDS.map((card) => card.key) as [CardKey, ...CardKey[]];

/** A card's step: its label and statuses. */
export function dashboardCard(key: CardKey) {
  return DASHBOARD_CARDS.find((card) => card.key === key)!;
}

/** Each card's count: the sum of its statuses' counts (a status with no imports counts 0). */
export function cardCounts(byStatus: Partial<Record<StatusKey, number>>): CardCounts {
  return Object.fromEntries(
    DASHBOARD_CARDS.map((card) => [card.key, card.statuses.reduce((sum: number, status: StatusKey) => sum + (byStatus[status] ?? 0), 0)]),
  ) as CardCounts;
}
