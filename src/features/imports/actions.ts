"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { getRequestInfo } from "@/lib/request-info";
import { done, fail, invalidInput, notFound, ok, type ActionResult, type Result } from "@/lib/result";
import { formToObject, idSchema } from "@/lib/schemas";
import { recordAudit } from "@/features/audit/record";
import { requireMenuItem } from "@/features/auth/guards";
import { importFormSchema, normaliseForParticular, shapeImportForm, submitProblems } from "@/features/imports/form";
import { removeImportFiles } from "@/features/imports/document-storage";
import { documentProblems } from "@/features/imports/documents";
import { checkImportReferences, findBlNumbersInUse, getEditableImport, getImportParticular, getUnitLegacyIds, listImportDocuments } from "@/features/imports/queries";
import { applyImportRules } from "@/features/imports/rules";
import { listTransactionTypeKeyFields } from "@/features/reference/queries";
import { createImport, hideImport, recordImportStep, removeImportDocumentRow, saveImportForm } from "@/features/imports/writes";
import { statusesAllowing } from "@/features/workflow/actions";
import { deleteSubmission } from "@/features/workflow/delete";

/*
 * Actions on imports: start one (choose the Particular: the draft and its tracking number are
 * created at once), save it as a draft or submit it, and Delete from the list (hides it). Each:
 * guard from the menu → parse → only an Enterprise user's own organisation → write → audit.
 */

const startImportSchema = z.object({ transactionTypeId: idSchema });

export async function startImport(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const member = await requireMenuItem("/imports/new");
  const parsed = startImportSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Choose a Particular.", "invalid_input", { transactionTypeId: "Choose a Particular" });
  if (!member.organisationId) return notFound("Your organisation");

  const { ipAddress } = await getRequestInfo();
  const organisationId = member.organisationId;
  const created = await withTransaction(async (tx) => {
    const row = await createImport(tx, { organisationId, accountId: member.id, transactionTypeId: parsed.data.transactionTypeId });
    if (row) {
      await recordImportStep(tx, { importId: row.id, statusKey: "draft", decision: "created", actor: { id: member.id, name: member.fullName, role: member.role } });
      await recordAudit(tx, {
        eventType: "import.created",
        actor: { id: member.id, email: member.email },
        target: row.trackingNumber,
        detail: row.id,
        ipAddress,
      });
    }
    return row;
  });
  if (!created) return fail("This Particular is not available for imports.", "invalid_input", { transactionTypeId: "Choose another Particular" });
  redirect(`/imports/${created.id}/edit`);
}

export async function saveImport(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const member = await requireMenuItem("/imports");
  if (member.role !== "enterprise" || !member.organisationId) return notFound("Import");
  const parsed = importFormSchema.safeParse(shapeImportForm(formToObject(formData)));
  if (!parsed.success) return invalidInput(parsed.error);

  const particular = await getImportParticular(member.organisationId, parsed.data.importId);
  if (!particular) return notFound("Import");
  const settings = { legacyId: particular.legacyId, keyFields: await listTransactionTypeKeyFields(particular.transactionTypeId) };
  const normalised = normaliseForParticular(parsed.data, settings);
  // No foreign keys (0012): every id the form refers to must exist, for a draft too.
  const unknownReferences = await checkImportReferences(normalised);
  if (Object.keys(unknownReferences).length > 0) return fail("Some choices are no longer in their lists: choose them again.", "invalid_input", unknownReferences);
  const submit = normalised.intent === "submit";

  // The old form's rules and calculations, done here whatever the browser showed (rules.ts).
  const [units, blNumbersInUse] = await Promise.all([
    getUnitLegacyIds([normalised.shipmentUnitId, ...normalised.items.map((item) => item.unitId)].filter((id): id is string => Boolean(id))),
    findBlNumbersInUse(normalised.importId, normalised.blNumbers.filter((value): value is string => Boolean(value))),
  ]);
  const { form, itemValues, problems: ruleProblems } = applyImportRules({ form: normalised, settings, units, blNumbersInUse, submit });

  if (submit) {
    // Every required field, line and document (the files are already uploaded: they are checked as stored).
    const documents = await listImportDocuments(form.importId);
    const duty = settings.keyFields.find((field) => field.fieldKey === "dutyPaidFile");
    const problems = {
      ...submitProblems(form, settings),
      ...documentProblems(documents.slots, { shown: Boolean(duty), required: duty?.required ?? false, dutyPaid: form.dutyPaid, files: documents.dutyFiles }),
      ...ruleProblems,
    };
    if (Object.keys(problems).length > 0) {
      return fail(problems.itemFobTotal ?? "The import cannot be submitted yet: complete the highlighted fields.", "invalid_input", problems);
    }
  } else if (Object.keys(ruleProblems).length > 0) {
    return fail("The draft was not saved: correct the highlighted fields.", "invalid_input", ruleProblems);
  }

  const { ipAddress } = await getRequestInfo();
  const organisationId = member.organisationId;
  const saved = await withTransaction(async (tx) => {
    const ok = await saveImportForm(tx, {
      organisationId,
      editableStatuses: statusesAllowing("import", member.role, "edit"),
      form,
      itemValues,
      submit,
    });
    if (ok && submit) {
      await recordImportStep(tx, { importId: form.importId, statusKey: "submitted", decision: "submitted", actor: { id: member.id, name: member.fullName, role: member.role } });
      await recordAudit(tx, {
        eventType: "import.submitted",
        actor: { id: member.id, email: member.email },
        target: form.importId,
        ipAddress,
      });
    }
    return ok;
  });
  if (!saved) return notFound("Import");
  if (submit) redirect(`/imports/${form.importId}`);
  refresh();
  return done("Draft saved.");
}

export async function deleteImport(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const member = await requireMenuItem("/imports");
  return deleteSubmission(member, "import", formData, hideImport);
}

const removeDocumentSchema = z.object({ importId: idSchema, fileId: idSchema });

/** Removes one uploaded file of an editable import; answers with the import's documents as they now are. */
export async function removeImportDocument(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<Result<Awaited<ReturnType<typeof listImportDocuments>>>> {
  const member = await requireMenuItem("/imports");
  if (member.role !== "enterprise" || !member.organisationId) return notFound("Document");
  const parsed = removeDocumentSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  const editableStatuses = statusesAllowing("import", member.role, "edit");
  const editable = await getEditableImport(member.organisationId, parsed.data.importId, editableStatuses);
  if (!editable) return notFound("Import");

  const organisationId = member.organisationId;
  const storedName = await withTransaction((tx) =>
    removeImportDocumentRow(tx, { importId: parsed.data.importId, fileId: parsed.data.fileId, organisationId, editableStatuses }),
  );
  if (!storedName) return notFound("Document");
  await removeImportFiles(parsed.data.importId, [storedName]);
  return ok(await listImportDocuments(parsed.data.importId));
}
