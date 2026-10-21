import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { withTransaction } from "@/lib/db";
import { fail, ok, type Result } from "@/lib/result";
import { idSchema } from "@/lib/schemas";
import { getRequestInfo } from "@/lib/request-info";
import { recordAudit } from "@/features/audit/record";
import { requireRole } from "@/features/auth/guards";
import { removeImportFiles, storeImportFile } from "@/features/imports/document-storage";
import { checkDocumentFile, cleanFileName, MAX_DOCUMENT_BYTES } from "@/features/imports/documents";
import { getImport } from "@/features/imports/queries";
import { addImportDocument, moveImportStatus, recordImportStep } from "@/features/imports/writes";
import { LETTER_KINDS, MAX_REASON_LENGTH, REVIEW_DECISIONS, reviewStep } from "@/features/workflow/review";
import type { StatusKey } from "@/features/workflow/statuses";

/**
 * POST /api/imports/<id>/review — one step of the approval process by an LFZ Admin or NEPZA
 * (old UpdateApplicantStatus / EnterpriseLetter; decision log 2026-10-19). A route rather than a
 * server action because the letter may be up to 5 MB (a server action takes 1 MB unless the suite
 * kit's next.config.ts changes).
 *
 * Form fields: `decision` (approve, reject, final_approve, reject_nepza_letter,
 * resubmit_nepza_letter), `reason` (rejections), `letter` (the file a step needs).
 *
 * Guard → same-origin check → size before reading → the import is in the member's scope (the
 * list's) → the step is one this role may take at its CURRENT status (features/workflow/review.ts)
 * → reason and letter as the step needs → store the letter → in one transaction: move the status
 * only from the status the step was offered at, record the letter, the timeline step and the
 * audit event. Someone else acting first → 409, and the stored letter is removed.
 */

type Answer = Result<{ status: StatusKey }>;

function answer(result: Answer, status = 200) {
  return NextResponse.json(result, { status, headers: { "Cache-Control": "private, no-store" } });
}

const fieldsSchema = z.object({
  decision: z.enum(REVIEW_DECISIONS),
  reason: z.string().trim().max(MAX_REASON_LENGTH, `At most ${MAX_REASON_LENGTH} characters`).optional(),
});

export async function POST(request: NextRequest, context: RouteContext<"/api/imports/[id]/review">) {
  const member = await requireRole("lfz_admin", "nepza");
  if (request.headers.get("origin") !== new URL(getConfig().appUrl).origin) return answer(fail("The request did not come from DigiDocs."), 403);
  const importId = idSchema.safeParse((await context.params).id);
  if (!importId.success) return answer(fail("Import was not found.", "not_found"), 404);

  const length = Number(request.headers.get("content-length") ?? "");
  if (!Number.isFinite(length) || length <= 0) return answer(fail("The request has no size.", "invalid_input"), 411);
  if (length > MAX_DOCUMENT_BYTES + 64 * 1024) return answer(fail("The letter is larger than 5 MB.", "invalid_input", { letter: "Larger than 5 MB" }), 413);

  const record = await getImport(member, importId.data);
  if (!record) return answer(fail("Import was not found.", "not_found"), 404);

  const form = await request.formData();
  const fields = fieldsSchema.safeParse({ decision: form.get("decision"), reason: form.get("reason") ?? undefined });
  if (!fields.success) return answer(fail("Check the highlighted fields.", "invalid_input", { reason: fields.error.issues[0]?.message ?? "Invalid" }), 400);

  const step = reviewStep(member.role, record.status, fields.data.decision);
  if (!step) return answer(fail("This step is no longer possible: the import has moved on. Reload the page.", "conflict"), 409);

  const reason = fields.data.reason || null;
  if (step.reasonRequired && !reason) return answer(fail("Give a reason.", "invalid_input", { reason: "A reason is required" }), 400);

  let letter: { bytes: Uint8Array; name: string; extension: Parameters<typeof storeImportFile>[1]; contentType: string } | null = null;
  if (step.letter) {
    const file = form.get("letter");
    if (!(file instanceof File) || file.size === 0) {
      return answer(fail(`Upload the ${LETTER_KINDS[step.letter]}.`, "invalid_input", { letter: `Upload the ${LETTER_KINDS[step.letter]}` }), 400);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkDocumentFile({ name: file.name, size: bytes.byteLength, head: bytes.subarray(0, 16) });
    if (!check.ok) return answer(fail(check.error, "invalid_input", { letter: check.error }), 400);
    letter = { bytes, name: cleanFileName(file.name), extension: check.extension, contentType: check.contentType };
  }

  const storedName = letter ? await storeImportFile(importId.data, letter.extension, letter.bytes) : null;
  const { ipAddress } = await getRequestInfo();
  let moved: boolean;
  try {
    moved = await withTransaction(async (tx) => {
      if (!(await moveImportStatus(tx, { importId: importId.data, fromStatus: record.status, toStatus: step.to, reason: step.reasonRequired ? reason : null }))) {
        return false;
      }
      const letterDocument =
        letter && storedName && step.letter
          ? await addImportDocument(tx, {
              importId: importId.data,
              purpose: step.letter,
              documentTypeId: null,
              replace: false, // every letter is kept, a rejected one too
              originalName: letter.name,
              storedName,
              contentType: letter.contentType,
              sizeBytes: letter.bytes.byteLength,
              accountId: member.id,
            })
          : null;
      await recordImportStep(tx, {
        importId: importId.data,
        statusKey: step.to,
        decision: step.decision,
        reason: step.reasonRequired ? reason : null,
        letterDocumentId: letterDocument?.id ?? null,
        actor: { id: member.id, name: member.fullName, role: member.role },
      });
      await recordAudit(tx, {
        eventType: "import.reviewed",
        actor: { id: member.id, email: member.email },
        target: record.trackingNumber ?? importId.data,
        detail: `${step.decision}: ${record.status} → ${step.to}`,
        ipAddress,
      });
      return true;
    });
  } catch (error) {
    if (storedName) await removeImportFiles(importId.data, [storedName]);
    throw error;
  }
  if (!moved) {
    if (storedName) await removeImportFiles(importId.data, [storedName]);
    return answer(fail("Someone else acted on this import first. Reload the page.", "conflict"), 409);
  }
  return answer(ok({ status: step.to }));
}
