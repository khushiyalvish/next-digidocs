import { z } from "zod";
import { idSchema } from "@/lib/schemas";
import { containsPattern } from "@/lib/sql-text";
import type { Member } from "@/features/auth/guards";
import { CARD_KEYS, dashboardCard } from "@/features/dashboard/steps";
import { listableStatuses, REJECTED_STATUSES, STATUS_KEYS, type StatusKey } from "@/features/workflow/statuses";

/*
 * What the import list and the export list have in common: their address-bar filters, which rows
 * a caller may get, and the row they show. Imports and exports are separate (their own tables,
 * queries and, later, mapping tables: features/imports, features/exports); only these rules are
 * shared.
 *
 * Pure: no database, no session read (the caller passes the member from its guard).
 */

export const LIST_PAGE_SIZE = 50;

/**
 * The lists' address-bar filters: search text, status, transaction type ("Particular"),
 * enterprise, the dashboard step a card opened, page. Anything malformed falls back to "no
 * filter", never an error.
 */
export const listFilterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(STATUS_KEYS).optional().catch(undefined),
  type: idSchema.optional().catch(undefined),
  enterprise: idSchema.optional().catch(undefined),
  step: z.enum(CARD_KEYS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});
export type ListFilter = z.infer<typeof listFilterSchema>;

export interface ListScope {
  /** Nothing to show: the query must not run (an empty IN list is a syntax error). */
  nothing: boolean;
  statuses: StatusKey[];
  organisationId: string | null;
  type: string | null;
  pattern: string | null;
  offset: number;
}

/**
 * The query parameters of a list. Statuses: what the role sees, narrowed by the chosen status and
 * step. Organisation: an Enterprise user is always held to their own, whatever the address bar
 * says (ARCHITECTURE.md §2, scoping); the enterprise filter is for everyone else.
 */
export function listScope(member: Member, filter: ListFilter): ListScope {
  const statuses = listableStatuses(member.role, {
    status: filter.status,
    stepStatuses: filter.step ? dashboardCard(filter.step).statuses : undefined,
  });
  const organisationId = member.role === "enterprise" ? member.organisationId : (filter.enterprise ?? null);
  return {
    nothing: statuses.length === 0 || (member.role === "enterprise" && !organisationId),
    statuses,
    organisationId,
    type: filter.type ?? null,
    pattern: containsPattern(filter.q),
    offset: (filter.page - 1) * LIST_PAGE_SIZE,
  };
}

/** One row of the import or export list. */
export interface ListRowDto {
  id: string;
  enterpriseName: string;
  enterpriseCode: string;
  transactionName: string;
  trackingNumber: string | null;
  status: StatusKey;
  /** The rejection reason; only for a rejected status ("Remarks"). */
  remarks: string | null;
  createdAt: string;
  formSavedAt: string | null;
  submittedAt: string | null;
}

export interface ListPage {
  rows: ListRowDto[];
  total: number;
}

/** The columns both list queries select, as SQL Server returns them. */
export type ListRow = {
  id: string;
  company_name: string;
  short_code: string;
  transaction_name: string;
  tracking_number: string | null;
  status_key: StatusKey;
  status_reason: string | null;
  created_at: Date;
  form_saved_at: Date | null;
  submitted_at: Date | null;
  total: number;
};

export function toListPage(rows: ListRow[]): ListPage {
  return {
    total: rows[0]?.total ?? 0,
    rows: rows.map((row) => ({
      id: row.id.toLowerCase(),
      enterpriseName: row.company_name,
      enterpriseCode: row.short_code,
      transactionName: row.transaction_name,
      trackingNumber: row.tracking_number,
      status: row.status_key,
      remarks: REJECTED_STATUSES.includes(row.status_key) ? row.status_reason : null,
      createdAt: row.created_at.toISOString(),
      formSavedAt: row.form_saved_at?.toISOString() ?? null,
      submittedAt: row.submitted_at?.toISOString() ?? null,
    })),
  };
}
