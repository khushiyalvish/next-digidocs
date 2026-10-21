import "server-only";
import { refresh } from "next/cache";
import { withTransaction, type Db } from "@/lib/db";
import { getRequestInfo } from "@/lib/request-info";
import { done, invalidInput, notFound, type ActionResult } from "@/lib/result";
import { formToObject } from "@/lib/schemas";
import { recordAudit } from "@/features/audit/record";
import type { Member } from "@/features/auth/guards";
import { statusesAllowing, type SubmissionKind } from "@/features/workflow/actions";
import { submissionIdSchema } from "@/features/workflow/list";
import type { StatusKey } from "@/features/workflow/statuses";

type Hide = (db: Db, input: { id: string; organisationId: string; accountId: string; statuses: readonly StatusKey[] }) => Promise<string | null>;

/**
 * "Delete" on a list row, shared by the import and export actions (each passes its own writer):
 * parse the id → only an Enterprise user, only their organisation's record, only in a status the
 * row rules allow deleting (features/workflow/actions.ts) → hide it and audit, in one
 * transaction. Anything else reads as not found. The caller has run its guard.
 */
export async function deleteSubmission(member: Member, kind: SubmissionKind, formData: FormData, hide: Hide): Promise<ActionResult> {
  const what = kind === "import" ? "Import" : "Export";
  const parsed = submissionIdSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  if (member.role !== "enterprise" || !member.organisationId) return notFound(what);

  const { ipAddress } = await getRequestInfo();
  const organisationId = member.organisationId;
  const tracking = await withTransaction(async (tx) => {
    const hidden = await hide(tx, {
      id: parsed.data.id,
      organisationId,
      accountId: member.id,
      statuses: statusesAllowing(kind, member.role, "delete"),
    });
    if (hidden !== null) {
      await recordAudit(tx, {
        eventType: kind === "import" ? "import.deleted" : "export.deleted",
        actor: { id: member.id, email: member.email },
        target: hidden || `${what} without a tracking number`,
        detail: parsed.data.id,
        ipAddress,
      });
    }
    return hidden;
  });
  if (tracking === null) return notFound(what);
  refresh();
  return done(tracking ? `${what} ${tracking} deleted.` : `${what} deleted.`);
}
