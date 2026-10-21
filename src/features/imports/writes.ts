import "server-only";
import type { Db } from "@/lib/db";
import type { ItemValues } from "@/features/imports/calculation";
import type { ImportFormData } from "@/features/imports/form";
import type { ReviewDecision, LetterKind } from "@/features/workflow/review";
import type { StatusKey } from "@/features/workflow/statuses";

/*
 * The only writer of dbo.imports and its lines (import_bl_numbers, import_invoices,
 * import_containers, import_items, import_documents): creating a draft, saving the form, adding and
 * removing uploaded files, and "Delete" from the list, which hides the import (0008; old ImpExp_D
 * set IsActive = 0).
 */

/**
 * Hides one import of this organisation, only while it is in one of these statuses and not hidden
 * yet — one conditional statement, so two clicks or a status change in between cannot hide
 * something that may no longer be deleted. Returns its tracking number (or "" if it has none), or
 * null when nothing was hidden.
 */
export async function hideImport(
  db: Db,
  input: { id: string; organisationId: string; accountId: string; statuses: readonly StatusKey[] },
): Promise<string | null> {
  if (input.statuses.length === 0) return null;
  const [row] = await db.query<{ tracking_number: string | null }>`
    UPDATE dbo.imports
    SET deleted_at = SYSDATETIMEOFFSET(), deleted_by_account_id = ${input.accountId}, updated_at = SYSDATETIMEOFFSET()
    OUTPUT inserted.tracking_number
    WHERE id = ${input.id}
      AND organisation_id = ${input.organisationId}
      AND deleted_at IS NULL
      AND status_key IN (${input.statuses})`;
  return row ? (row.tracking_number ?? "") : null;
}

/**
 * Creates a draft import when the Particular is chosen, with its tracking number: the
 * organisation's short code / the Particular's short code / YYYYMM + a 5-digit running number
 * (old GenerateTrackingNo). Only an active import Particular and an active organisation; null
 * otherwise.
 */
export async function createImport(
  db: Db,
  input: { organisationId: string; accountId: string; transactionTypeId: string },
): Promise<{ id: string; trackingNumber: string } | null> {
  const [row] = await db.query<{ id: string; tracking_number: string }>`
    DECLARE @running INT = NEXT VALUE FOR dbo.import_tracking_numbers;
    INSERT INTO dbo.imports (organisation_id, created_by_account_id, transaction_type_id, tracking_number, status_key)
    OUTPUT inserted.id, inserted.tracking_number
    SELECT o.id, ${input.accountId}, t.id,
           CONCAT(o.short_code, '/', t.short_code, '/', FORMAT(SYSDATETIMEOFFSET(), 'yyyyMM'), FORMAT(@running, '00000')),
           'draft'
    FROM dbo.organisations o
    JOIN dbo.transaction_types t ON t.id = ${input.transactionTypeId} AND t.direction = 'import' AND t.is_active = 1
    WHERE o.id = ${input.organisationId} AND o.is_active = 1`;
  return row ? { id: row.id.toLowerCase(), trackingNumber: row.tracking_number } : null;
}

/**
 * Saves the form of one import of this organisation — key information and every line (replaced
 * as a whole) — only while it is in an editable status and not hidden. `submit` also moves it to
 * "Submitted to LFTZ". Returns false when nothing was saved (not theirs, gone, or no longer
 * editable). Run it in a transaction: the lines are deleted and inserted after the update.
 */
export async function saveImportForm(
  db: Db,
  input: {
    organisationId: string;
    editableStatuses: readonly StatusKey[];
    form: ImportFormData;
    /** Each item's calculated values (features/imports/rules.ts), in the items' order. */
    itemValues: readonly ItemValues[];
    submit: boolean;
  },
): Promise<boolean> {
  if (input.editableStatuses.length === 0) return false;
  const f = input.form;
  const rows = await db.query`
    UPDATE dbo.imports
    SET import_country_id = ${f.importCountryId}, import_state_id = ${f.importStateId}, clearing_agent_id = ${f.clearingAgentId},
        shipping_mode = ${f.shippingMode}, discharge_port_id = ${f.dischargePortId}, consignment_currency_id = ${f.consignmentCurrencyId},
        packing_list_number = ${f.packingListNumber}, freight_value = ${f.freightValue}, insurance_value = ${f.insuranceValue},
        shipment_quantity = ${f.shipmentQuantity}, air_quantity = ${f.airQuantity}, shipment_unit_id = ${f.shipmentUnitId},
        total_cbm = ${f.totalCbm}, total_tonnes = ${f.totalTonnes}, duty_paid = ${f.dutyPaid},
        duty_reference_number = ${f.dutyPaid === true ? f.dutyReferenceNumber : null}, material_description = ${f.materialDescription},
        consignment_value = ${f.consignmentValue}, invoice_number = ${f.invoiceNumber}, container_count = ${f.containerCount},
        invoice_type = ${f.invoiceType},
        form_saved_at = SYSDATETIMEOFFSET(), updated_at = SYSDATETIMEOFFSET(),
        status_key = CASE WHEN ${input.submit} = 1 THEN 'submitted' ELSE status_key END,
        submitted_at = CASE WHEN ${input.submit} = 1 THEN SYSDATETIMEOFFSET() ELSE submitted_at END,
        status_reason = CASE WHEN ${input.submit} = 1 THEN NULL ELSE status_reason END
    OUTPUT inserted.id
    WHERE id = ${f.importId}
      AND organisation_id = ${input.organisationId}
      AND deleted_at IS NULL
      AND status_key IN (${input.editableStatuses})`;
  if (rows.length === 0) return false;

  const importId = f.importId;
  await db.query`DELETE FROM dbo.import_bl_numbers WHERE import_id = ${importId}`;
  await db.query`DELETE FROM dbo.import_invoices WHERE import_id = ${importId}`;
  await db.query`DELETE FROM dbo.import_containers WHERE import_id = ${importId}`;
  await db.query`DELETE FROM dbo.import_items WHERE import_id = ${importId}`;

  for (const [index, blNumber] of f.blNumbers.entries()) {
    await db.query`INSERT INTO dbo.import_bl_numbers (import_id, line_number, bl_number) VALUES (${importId}, ${index + 1}, ${blNumber})`;
  }
  for (const [index, line] of f.invoices.entries()) {
    await db.query`
      INSERT INTO dbo.import_invoices (import_id, line_number, invoice_number, invoice_date, fob_value, supplier_name)
      VALUES (${importId}, ${index + 1}, ${line.invoiceNumber}, ${line.invoiceDate}, ${line.fobValue}, ${line.supplierName})`;
  }
  for (const [index, line] of f.containers.entries()) {
    await db.query`
      INSERT INTO dbo.import_containers (import_id, line_number, container_number, container_size, seal_number)
      VALUES (${importId}, ${index + 1}, ${line.containerNumber}, ${line.containerSize}, ${line.sealNumber})`;
  }
  // The calculated values come from the server's own calculation (rules.ts); the HSE code's rates
  // are copied onto the item (0013), so a later tariff change leaves it as it was.
  for (const [index, line] of f.items.entries()) {
    const values = input.itemValues[index];
    await db.query`
      INSERT INTO dbo.import_items
        (import_id, line_number, item_name, fob_value, quantity, unit_id, unit_price, hse_code_id,
         allocated_freight, allocated_insurance, cif_value, ciss_value, etls_value,
         import_duty_rate, levy_rate, excise_rate, vat_rate)
      SELECT ${importId}, ${index + 1}, ${line.itemName}, ${line.fobValue}, ${line.quantity}, ${line.unitId}, ${line.unitPrice}, ${line.hseCodeId},
             ${values?.allocatedFreight ?? null}, ${values?.allocatedInsurance ?? null}, ${values?.cif ?? null}, ${values?.ciss ?? null}, ${values?.etls ?? null},
             h.import_duty_rate, h.levy_rate, h.excise_rate, h.vat_rate
      FROM (SELECT 1 AS one) AS item
      LEFT JOIN dbo.hse_codes h ON h.id = ${line.hseCodeId}`;
  }
  return true;
}

/**
 * Records an uploaded file of an import (the file is already in the uploads folder). With
 * `replace`, the earlier files of the same document go (one file per document, except "Others");
 * their stored names are returned so the caller removes them from the folder after the commit.
 */
export async function addImportDocument(
  db: Db,
  input: {
    importId: string;
    purpose: "document" | "duty_paid" | LetterKind;
    documentTypeId: string | null;
    replace: boolean;
    originalName: string;
    storedName: string;
    contentType: string;
    sizeBytes: number;
    accountId: string;
  },
): Promise<{ id: string; replaced: string[] }> {
  const replaced = input.replace
    ? await db.query<{ stored_name: string }>`
        DELETE FROM dbo.import_documents
        OUTPUT deleted.stored_name
        WHERE import_id = ${input.importId} AND purpose = ${input.purpose}
          AND (document_type_id = ${input.documentTypeId} OR (${input.documentTypeId} IS NULL AND document_type_id IS NULL))`
    : [];
  const [row] = await db.query<{ id: string }>`
    INSERT INTO dbo.import_documents
      (import_id, purpose, document_type_id, original_name, stored_name, content_type, size_bytes, uploaded_by_account_id)
    OUTPUT inserted.id
    VALUES (${input.importId}, ${input.purpose}, ${input.documentTypeId}, ${input.originalName}, ${input.storedName},
            ${input.contentType}, ${input.sizeBytes}, ${input.accountId})`;
  return { id: row.id.toLowerCase(), replaced: replaced.map((each) => each.stored_name) };
}

/**
 * Removes one uploaded file of an import of this organisation, only while the import is editable
 * and not hidden — one conditional statement. Returns the stored name to remove from the folder,
 * or null when nothing was removed.
 */
export async function removeImportDocumentRow(
  db: Db,
  input: { importId: string; fileId: string; organisationId: string; editableStatuses: readonly StatusKey[] },
): Promise<string | null> {
  if (input.editableStatuses.length === 0) return null;
  const [row] = await db.query<{ stored_name: string }>`
    DELETE d
    OUTPUT deleted.stored_name
    FROM dbo.import_documents d
    JOIN dbo.imports i ON i.id = d.import_id
    WHERE d.id = ${input.fileId} AND d.import_id = ${input.importId}
      AND i.organisation_id = ${input.organisationId} AND i.deleted_at IS NULL
      AND i.status_key IN (${input.editableStatuses})`;
  return row?.stored_name ?? null;
}

/**
 * Moves an import of any organisation from one status to the next, only if it is still in the
 * status the step was offered at and not hidden — one conditional statement, so two officers
 * acting at once cannot both move it. The reason (rejections) becomes the import's status reason,
 * which the list shows as Remarks; an approval clears it. Returns false when nothing moved.
 */
export async function moveImportStatus(
  db: Db,
  input: { importId: string; fromStatus: StatusKey; toStatus: StatusKey; reason: string | null },
): Promise<boolean> {
  const rows = await db.query`
    UPDATE dbo.imports
    SET status_key = ${input.toStatus}, status_reason = ${input.reason}, updated_at = SYSDATETIMEOFFSET()
    OUTPUT inserted.id
    WHERE id = ${input.importId} AND deleted_at IS NULL AND status_key = ${input.fromStatus}`;
  return rows.length > 0;
}

/** One step of an import's timeline (0015; old T_ImpExpProcess). The actor's name and role are kept as they were. */
export async function recordImportStep(
  db: Db,
  input: {
    importId: string;
    statusKey: StatusKey;
    decision: "created" | "submitted" | ReviewDecision;
    reason?: string | null;
    letterDocumentId?: string | null;
    actor: { id: string; name: string; role: string };
  },
): Promise<void> {
  await db.query`
    INSERT INTO dbo.import_status_history (import_id, status_key, decision, reason, letter_document_id, actor_account_id, actor_name, actor_role)
    VALUES (${input.importId}, ${input.statusKey}, ${input.decision}, ${input.reason ?? null}, ${input.letterDocumentId ?? null},
            ${input.actor.id}, ${input.actor.name.slice(0, 200)}, ${input.actor.role})`;
}
