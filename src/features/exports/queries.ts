import "server-only";
import { db } from "@/lib/db";
import type { Member } from "@/features/auth/guards";
import { LIST_PAGE_SIZE, listScope, toListPage, type ListFilter, type ListPage, type ListRow } from "@/features/workflow/list";

/*
 * Reads of exports (dbo.exports; old DigiDocs: Map_ExportKeyInfo). Every row a caller gets is one
 * their role may see; an Enterprise user only gets their own organisation's (features/workflow/list.ts).
 */

/** The export list (old Map_Export_List_G), newest first. */
export async function listExports(member: Member, filter: ListFilter): Promise<ListPage> {
  const scope = listScope(member, filter);
  if (scope.nothing) return { rows: [], total: 0 };
  const rows = await db.query<ListRow>`
    SELECT e.id, o.company_name, o.short_code, t.transaction_name, e.tracking_number, e.status_key, e.status_reason,
           e.created_at, e.form_saved_at, e.submitted_at, COUNT(*) OVER () AS total
    FROM dbo.exports e
    JOIN dbo.organisations o ON o.id = e.organisation_id
    JOIN dbo.transaction_types t ON t.id = e.transaction_type_id
    WHERE e.status_key IN (${scope.statuses})
      AND (${scope.organisationId} IS NULL OR e.organisation_id = ${scope.organisationId})
      AND (${scope.type} IS NULL OR e.transaction_type_id = ${scope.type})
      AND (${scope.pattern} IS NULL OR e.tracking_number LIKE ${scope.pattern} ESCAPE '\\'
           OR o.company_name LIKE ${scope.pattern} ESCAPE '\\' OR o.short_code LIKE ${scope.pattern} ESCAPE '\\')
    ORDER BY e.created_at DESC, e.id
    OFFSET ${scope.offset} ROWS FETCH NEXT ${LIST_PAGE_SIZE} ROWS ONLY`;
  return toListPage(rows);
}
