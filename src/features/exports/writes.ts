import "server-only";
import type { Db } from "@/lib/db";
import type { StatusKey } from "@/features/workflow/statuses";

/*
 * The only writer of dbo.exports. So far: "Delete" from the list, which hides the export (0008;
 * old Exp_D set IsActive = 0). Add Export brings the inserts and updates.
 */

/**
 * Hides one export of this organisation, only while it is in one of these statuses and not hidden
 * yet — one conditional statement, so two clicks or a status change in between cannot hide
 * something that may no longer be deleted. Returns its tracking number (or "" if it has none), or
 * null when nothing was hidden.
 */
export async function hideExport(
  db: Db,
  input: { id: string; organisationId: string; accountId: string; statuses: readonly StatusKey[] },
): Promise<string | null> {
  if (input.statuses.length === 0) return null;
  const [row] = await db.query<{ tracking_number: string | null }>`
    UPDATE dbo.exports
    SET deleted_at = SYSDATETIMEOFFSET(), deleted_by_account_id = ${input.accountId}, updated_at = SYSDATETIMEOFFSET()
    OUTPUT inserted.tracking_number
    WHERE id = ${input.id}
      AND organisation_id = ${input.organisationId}
      AND deleted_at IS NULL
      AND status_key IN (${input.statuses})`;
  return row ? (row.tracking_number ?? "") : null;
}
