import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { withTransaction } from "@/lib/db";
import { fail, ok, type Result } from "@/lib/result";
import { idSchema } from "@/lib/schemas";
import { requireRole } from "@/features/auth/guards";
import { removeImportFiles, storeImportFile } from "@/features/imports/document-storage";
import { checkDocumentFile, cleanFileName, MAX_DOCUMENT_BYTES, type DocumentSlot, type UploadedFile } from "@/features/imports/documents";
import { getEditableImport, listImportDocuments } from "@/features/imports/queries";
import { addImportDocument } from "@/features/imports/writes";
import { listTransactionTypeKeyFields } from "@/features/reference/queries";
import { statusesAllowing } from "@/features/workflow/actions";

/**
 * POST /api/imports/<id>/documents — uploads one file to a document of an Enterprise user's
 * editable import (decision log 2026-10-15). A route rather than a server action because a server
 * action body is limited to 1 MB unless the suite kit's next.config.ts changes.
 *
 * Form fields: `file`, and `target`: a document type id of the import's Particular, "all" (the
 * old "Upload to All": the same file to every one-file document) or "duty_paid" (the key
 * information's Duty Paid File). Answers with the import's documents as they now are.
 *
 * Guard → same-origin check (with the session cookie's SameSite=Lax, a page on another site cannot
 * post here) → size before reading the body → the import is theirs and editable → the target
 * belongs to its Particular → the file's size, extension and content → store, then record in one
 * transaction (a failed record removes the stored files; replaced files go after the commit).
 */

type Documents = { slots: DocumentSlot[]; dutyFiles: UploadedFile[] };

const targetSchema = z.union([z.literal("all"), z.literal("duty_paid"), idSchema]);

function answer(result: Result<Documents>, status = 200) {
  return NextResponse.json(result, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest, context: RouteContext<"/api/imports/[id]/documents">) {
  const member = await requireRole("enterprise");
  if (request.headers.get("origin") !== new URL(getConfig().appUrl).origin) {
    return answer(fail("The upload did not come from DigiDocs."), 403);
  }
  const importId = idSchema.safeParse((await context.params).id);
  if (!importId.success || !member.organisationId) return answer(fail("Import was not found.", "not_found"), 404);

  // Refuse an oversized body before reading it: one file of at most 5 MB, plus the form's framing.
  const length = Number(request.headers.get("content-length") ?? "");
  if (!Number.isFinite(length) || length <= 0) return answer(fail("The upload has no size.", "invalid_input"), 411);
  if (length > MAX_DOCUMENT_BYTES + 64 * 1024) return answer(fail("The file is larger than 5 MB.", "invalid_input"), 413);

  const editable = await getEditableImport(member.organisationId, importId.data, statusesAllowing("import", member.role, "edit"));
  if (!editable) return answer(fail("Import was not found, or it can no longer be changed.", "not_found"), 404);

  const form = await request.formData();
  const target = targetSchema.safeParse(form.get("target"));
  const file = form.get("file");
  if (!target.success || !(file instanceof File)) return answer(fail("Choose a file and a document.", "invalid_input"), 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkDocumentFile({ name: file.name, size: bytes.byteLength, head: bytes.subarray(0, 16) });
  if (!check.ok) return answer(fail(check.error, "invalid_input"), 400);

  // Where the file goes: documents of this import's Particular only.
  const current = await listImportDocuments(importId.data);
  let targets: { purpose: "document" | "duty_paid"; documentTypeId: string | null; replace: boolean }[];
  if (target.data === "duty_paid") {
    const keyFields = await listTransactionTypeKeyFields(editable.transactionTypeId);
    if (!keyFields.some((field) => field.fieldKey === "dutyPaidFile")) return answer(fail("This import has no Duty Paid File.", "invalid_input"), 400);
    targets = [{ purpose: "duty_paid", documentTypeId: null, replace: true }];
  } else if (target.data === "all") {
    targets = current.slots.filter((slot) => !slot.multiple).map((slot) => ({ purpose: "document", documentTypeId: slot.documentTypeId, replace: true }));
  } else {
    const slot = current.slots.find((each) => each.documentTypeId === target.data);
    if (!slot) return answer(fail("This document is not one of this import's documents.", "invalid_input"), 400);
    targets = [{ purpose: "document", documentTypeId: slot.documentTypeId, replace: !slot.multiple }];
  }
  if (targets.length === 0) return answer(fail("This import has no documents to upload to.", "invalid_input"), 400);

  const originalName = cleanFileName(file.name);
  const stored: string[] = [];
  let replaced: string[] = [];
  try {
    for (let index = 0; index < targets.length; index++) stored.push(await storeImportFile(importId.data, check.extension, bytes));
    replaced = await withTransaction(async (tx) => {
      const gone: string[] = [];
      for (const [index, each] of targets.entries()) {
        const added = await addImportDocument(tx, {
          importId: importId.data,
          purpose: each.purpose,
          documentTypeId: each.documentTypeId,
          replace: each.replace,
          originalName,
          storedName: stored[index],
          contentType: check.contentType,
          sizeBytes: bytes.byteLength,
          accountId: member.id,
        });
        gone.push(...added.replaced);
      }
      return gone;
    });
  } catch (error) {
    await removeImportFiles(importId.data, stored);
    throw error;
  }
  await removeImportFiles(importId.data, replaced);

  return answer(ok(await listImportDocuments(importId.data)));
}
