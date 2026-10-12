import "server-only";
import { db } from "@/lib/db";
import type { Member } from "@/features/auth/guards";
import { LIST_PAGE_SIZE, listScope, toListPage, type ListFilter, type ListPage, type ListRow } from "@/features/workflow/list";
import { VISIBLE_STATUSES, type StatusKey } from "@/features/workflow/statuses";

/*
 * Reads of imports (dbo.imports; old DigiDocs: T_ImpExp). Every row a caller gets is one their
 * role may see; an Enterprise user only gets their own organisation's (features/workflow/list.ts).
 */

/** The import list (old ImpExp_G), newest first. */
export async function listImports(member: Member, filter: ListFilter): Promise<ListPage> {
  const scope = listScope(member, filter);
  if (scope.nothing) return { rows: [], total: 0 };
  const rows = await db.query<ListRow>`
    SELECT i.id, o.company_name, o.short_code, t.transaction_name, i.tracking_number, i.status_key, i.status_reason,
           i.created_at, i.form_saved_at, i.submitted_at, COUNT(*) OVER () AS total
    FROM dbo.imports i
    JOIN dbo.organisations o ON o.id = i.organisation_id
    JOIN dbo.transaction_types t ON t.id = i.transaction_type_id
    WHERE i.status_key IN (${scope.statuses})
      AND (${scope.organisationId} IS NULL OR i.organisation_id = ${scope.organisationId})
      AND (${scope.type} IS NULL OR i.transaction_type_id = ${scope.type})
      AND (${scope.pattern} IS NULL OR i.tracking_number LIKE ${scope.pattern} ESCAPE '\\'
           OR o.company_name LIKE ${scope.pattern} ESCAPE '\\' OR o.short_code LIKE ${scope.pattern} ESCAPE '\\')
    ORDER BY i.created_at DESC, i.id
    OFFSET ${scope.offset} ROWS FETCH NEXT ${LIST_PAGE_SIZE} ROWS ONLY`;
  return toListPage(rows);
}

/**
 * How many imports an LFZ Admin sees in each status, for the dashboard cards (old
 * GetDashBoardCount), filtered by transaction type and enterprise.
 */
export async function countImportsByStatus(filter: { type?: string; enterprise?: string }): Promise<Partial<Record<StatusKey, number>>> {
  const type = filter.type ?? null;
  const enterprise = filter.enterprise ?? null;
  const rows = await db.query<{ status_key: StatusKey; total: number }>`
    SELECT status_key, COUNT(*) AS total
    FROM dbo.imports
    WHERE status_key IN (${VISIBLE_STATUSES.lfz_admin})
      AND (${type} IS NULL OR transaction_type_id = ${type})
      AND (${enterprise} IS NULL OR organisation_id = ${enterprise})
    GROUP BY status_key`;
  return Object.fromEntries(rows.map((row) => [row.status_key, row.total]));
}
