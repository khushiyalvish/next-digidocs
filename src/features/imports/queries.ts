import "server-only";
import { db } from "@/lib/db";
import type { Member } from "@/features/auth/guards";
import { LIST_PAGE_SIZE, listScope, toListPage, type ListFilter, type ListPage, type ListRow, type ListRowDto } from "@/features/workflow/list";
import { OTHERS_DOCUMENT_LEGACY_ID, type DocumentSlot, type UploadedFile } from "@/features/imports/documents";
import { LETTER_KINDS, type LetterKind } from "@/features/workflow/review";
import type { ImportFormData } from "@/features/imports/form";
import type { StatusKey } from "@/features/workflow/statuses";

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
    WHERE i.deleted_at IS NULL
      AND i.status_key IN (${scope.statuses})
      AND (${scope.organisationId} IS NULL OR i.organisation_id = ${scope.organisationId})
      AND (${scope.type} IS NULL OR i.transaction_type_id = ${scope.type})
      AND (${scope.pattern} IS NULL OR i.tracking_number LIKE ${scope.pattern} ESCAPE '\\'
           OR o.company_name LIKE ${scope.pattern} ESCAPE '\\' OR o.short_code LIKE ${scope.pattern} ESCAPE '\\')
    ORDER BY i.created_at DESC, i.id
    OFFSET ${scope.offset} ROWS FETCH NEXT ${LIST_PAGE_SIZE} ROWS ONLY`;
  return toListPage(rows);
}

/**
 * How many imports the member sees in each status, for the dashboard cards (old
 * GetDashBoardCount), filtered by transaction type and enterprise. The same scope as the list the
 * cards open: an Enterprise user counts only their own organisation's imports, whatever the
 * enterprise filter says.
 */
export async function countImportsByStatus(
  member: Member,
  filter: { type?: string; enterprise?: string },
): Promise<Partial<Record<StatusKey, number>>> {
  const scope = listScope(member, { type: filter.type, enterprise: filter.enterprise, page: 1 });
  if (scope.nothing) return {};
  const rows = await db.query<{ status_key: StatusKey; total: number }>`
    SELECT status_key, COUNT(*) AS total
    FROM dbo.imports
    WHERE deleted_at IS NULL
      AND status_key IN (${scope.statuses})
      AND (${scope.organisationId} IS NULL OR organisation_id = ${scope.organisationId})
      AND (${scope.type} IS NULL OR transaction_type_id = ${scope.type})
    GROUP BY status_key`;
  return Object.fromEntries(rows.map((row) => [row.status_key, row.total]));
}

/**
 * One import for its view and edit pages, or null when it does not exist, is hidden, or is out of
 * the member's reach (a status their role does not see; for an Enterprise user, another
 * organisation's): the page then answers 404, never "forbidden".
 */
export async function getImport(member: Member, id: string): Promise<ListRowDto | null> {
  const scope = listScope(member, { page: 1 });
  if (scope.nothing) return null;
  const rows = await db.query<ListRow>`
    SELECT i.id, o.company_name, o.short_code, t.transaction_name, i.tracking_number, i.status_key, i.status_reason,
           i.created_at, i.form_saved_at, i.submitted_at, 1 AS total
    FROM dbo.imports i
    JOIN dbo.organisations o ON o.id = i.organisation_id
    JOIN dbo.transaction_types t ON t.id = i.transaction_type_id
    WHERE i.id = ${id}
      AND i.deleted_at IS NULL
      AND i.status_key IN (${scope.statuses})
      AND (${scope.organisationId} IS NULL OR i.organisation_id = ${scope.organisationId})`;
  return toListPage(rows).rows[0] ?? null;
}

/** One import as the Add Import form shows it: key information, its lines, and its Particular. */
export interface ImportFormDto {
  id: string;
  trackingNumber: string | null;
  status: StatusKey;
  createdAt: string;
  particular: { id: string; name: string; legacyId: number | null };
  invoiceType: "single" | "multiple";
  keyInfo: Record<string, string>;
  blNumbers: string[];
  invoices: { invoiceNumber: string; invoiceDate: string; fobValue: string; supplierName: string }[];
  containers: { containerNumber: string; containerSize: string; sealNumber: string }[];
  items: {
    itemName: string;
    fobValue: string;
    quantity: string;
    unitId: string;
    unitPrice: string;
    hse: { id: string; code: string; description: string | null; duty: number; levy: number; excise: number; vat: number } | null;
  }[];
}

const str = (value: unknown): string => (value === null || value === undefined ? "" : typeof value === "boolean" ? (value ? "yes" : "no") : String(value));
const id = (value: string | null): string => (value ? value.toLowerCase() : "");

/**
 * The import an Enterprise user is filling in, or null when it is not theirs, hidden, or gone.
 * Every value comes back as the form's text (decimals as stored, ids lower-cased, "" for empty).
 */
export async function getImportForm(member: Member, importId: string): Promise<ImportFormDto | null> {
  if (member.role !== "enterprise" || !member.organisationId) return null;
  const [row] = await db.query<{
    id: string;
    tracking_number: string | null;
    status_key: StatusKey;
    created_at: Date;
    transaction_type_id: string;
    transaction_name: string;
    legacy_id: number | null;
    invoice_type: "single" | "multiple";
    import_country_id: string | null;
    import_state_id: string | null;
    clearing_agent_id: string | null;
    shipping_mode: string | null;
    discharge_port_id: string | null;
    consignment_currency_id: string | null;
    packing_list_number: string | null;
    freight_value: number | null;
    insurance_value: number | null;
    shipment_quantity: number | null;
    air_quantity: number | null;
    shipment_unit_id: string | null;
    total_cbm: number | null;
    total_tonnes: number | null;
    duty_paid: boolean | null;
    duty_reference_number: string | null;
    material_description: string | null;
    consignment_value: number | null;
    invoice_number: string | null;
    container_count: number | null;
  }>`
    SELECT i.id, i.tracking_number, i.status_key, i.created_at, i.transaction_type_id, t.transaction_name, t.legacy_id, i.invoice_type,
           i.import_country_id, i.import_state_id, i.clearing_agent_id, i.shipping_mode, i.discharge_port_id, i.consignment_currency_id,
           i.packing_list_number, i.freight_value, i.insurance_value, i.shipment_quantity, i.air_quantity, i.shipment_unit_id,
           i.total_cbm, i.total_tonnes, i.duty_paid, i.duty_reference_number, i.material_description, i.consignment_value,
           i.invoice_number, i.container_count
    FROM dbo.imports i
    JOIN dbo.transaction_types t ON t.id = i.transaction_type_id
    WHERE i.id = ${importId} AND i.organisation_id = ${member.organisationId} AND i.deleted_at IS NULL`;
  if (!row) return null;

  const blNumbers = await db.query<{ bl_number: string | null }>`
    SELECT bl_number FROM dbo.import_bl_numbers WHERE import_id = ${importId} ORDER BY line_number`;
  const invoices = await db.query<{ invoice_number: string | null; invoice_date: string | null; fob_value: number | null; supplier_name: string | null }>`
    SELECT invoice_number, CONVERT(CHAR(10), invoice_date, 23) AS invoice_date, fob_value, supplier_name
    FROM dbo.import_invoices WHERE import_id = ${importId} ORDER BY line_number`;
  const containers = await db.query<{ container_number: string | null; container_size: string | null; seal_number: string | null }>`
    SELECT container_number, container_size, seal_number FROM dbo.import_containers WHERE import_id = ${importId} ORDER BY line_number`;
  const items = await db.query<{
    item_name: string | null;
    fob_value: number | null;
    quantity: number | null;
    unit_id: string | null;
    unit_price: number | null;
    hse_code_id: string | null;
    hse_code: string | null;
    goods_description: string | null;
    import_duty_rate: number | null;
    levy_rate: number | null;
    excise_rate: number | null;
    vat_rate: number | null;
  }>`
    SELECT it.item_name, it.fob_value, it.quantity, it.unit_id, it.unit_price, it.hse_code_id,
           h.hse_code, h.goods_description, h.import_duty_rate, h.levy_rate, h.excise_rate, h.vat_rate
    FROM dbo.import_items it
    LEFT JOIN dbo.hse_codes h ON h.id = it.hse_code_id
    WHERE it.import_id = ${importId}
    ORDER BY it.line_number`;

  return {
    id: row.id.toLowerCase(),
    trackingNumber: row.tracking_number,
    status: row.status_key,
    createdAt: row.created_at.toISOString(),
    particular: { id: row.transaction_type_id.toLowerCase(), name: row.transaction_name, legacyId: row.legacy_id },
    invoiceType: row.invoice_type,
    keyInfo: {
      importCountryId: id(row.import_country_id),
      importStateId: id(row.import_state_id),
      clearingAgentId: id(row.clearing_agent_id),
      shippingMode: str(row.shipping_mode),
      dischargePortId: id(row.discharge_port_id),
      consignmentCurrencyId: id(row.consignment_currency_id),
      packingListNumber: str(row.packing_list_number),
      freightValue: str(row.freight_value),
      insuranceValue: str(row.insurance_value),
      shipmentQuantity: str(row.shipment_quantity),
      airQuantity: str(row.air_quantity),
      shipmentUnitId: id(row.shipment_unit_id),
      totalCbm: str(row.total_cbm),
      totalTonnes: str(row.total_tonnes),
      dutyPaid: str(row.duty_paid),
      dutyReferenceNumber: str(row.duty_reference_number),
      materialDescription: str(row.material_description),
      consignmentValue: str(row.consignment_value),
      invoiceNumber: str(row.invoice_number),
      containerCount: str(row.container_count),
    },
    blNumbers: blNumbers.map((line) => str(line.bl_number)),
    invoices: invoices.map((line) => ({
      invoiceNumber: str(line.invoice_number),
      invoiceDate: str(line.invoice_date),
      fobValue: str(line.fob_value),
      supplierName: str(line.supplier_name),
    })),
    containers: containers.map((line) => ({
      containerNumber: str(line.container_number),
      containerSize: str(line.container_size),
      sealNumber: str(line.seal_number),
    })),
    items: items.map((line) => ({
      itemName: str(line.item_name),
      fobValue: str(line.fob_value),
      quantity: str(line.quantity),
      unitId: id(line.unit_id),
      unitPrice: str(line.unit_price),
      hse: line.hse_code_id
        ? {
            id: line.hse_code_id.toLowerCase(),
            code: line.hse_code ?? "",
            description: line.goods_description,
            duty: Number(line.import_duty_rate ?? 0),
            levy: Number(line.levy_rate ?? 0),
            excise: Number(line.excise_rate ?? 0),
            vat: Number(line.vat_rate ?? 0),
          }
        : null,
    })),
  };
}

/** The Particular of an import of this organisation (its id and old id), for reading its posted form; null when not theirs or hidden. */
export async function getImportParticular(organisationId: string, importId: string): Promise<{ transactionTypeId: string; legacyId: number | null } | null> {
  const [row] = await db.query<{ transaction_type_id: string; legacy_id: number | null }>`
    SELECT i.transaction_type_id, t.legacy_id
    FROM dbo.imports i
    JOIN dbo.transaction_types t ON t.id = i.transaction_type_id
    WHERE i.id = ${importId} AND i.organisation_id = ${organisationId} AND i.deleted_at IS NULL`;
  return row ? { transactionTypeId: row.transaction_type_id.toLowerCase(), legacyId: row.legacy_id } : null;
}

/** The documents of an import: the Particular's, the Duty Paid File, and the review letters (0015), oldest first. */
export interface ImportDocumentsDto {
  slots: DocumentSlot[];
  dutyFiles: UploadedFile[];
  letters: { kind: LetterKind; files: UploadedFile[] }[];
}

interface DocumentFileRow {
  id: string;
  purpose: "document" | "duty_paid" | LetterKind;
  document_type_id: string | null;
  original_name: string;
  size_bytes: number;
  uploaded_at: Date;
}

/**
 * The documents of an import's Particular (transaction_type_documents, active ones, old order),
 * each with its uploaded files, and the Duty Paid File(s). The caller has already checked that the
 * member may see this import (a scoped read such as getImport or getImportForm).
 */
export async function listImportDocuments(importId: string): Promise<ImportDocumentsDto> {
  const [types, files] = await Promise.all([
    db.query<{ id: string; document_name: string; is_mandatory: boolean; legacy_id: number | null }>`
      SELECT d.id, d.document_name, l.is_mandatory, d.legacy_id
      FROM dbo.transaction_type_documents l
      JOIN dbo.document_types d ON d.id = l.document_type_id
      WHERE l.transaction_type_id = (SELECT transaction_type_id FROM dbo.imports WHERE id = ${importId} AND deleted_at IS NULL)
        AND d.is_active = 1
      ORDER BY d.legacy_id`,
    db.query<DocumentFileRow>`
      SELECT id, purpose, document_type_id, original_name, size_bytes, uploaded_at
      FROM dbo.import_documents
      WHERE import_id = ${importId}
      ORDER BY uploaded_at, id`,
  ]);
  const toFile = (row: DocumentFileRow): UploadedFile => ({
    id: row.id.toLowerCase(),
    name: row.original_name,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at.toISOString(),
  });
  return {
    slots: types.map((type) => ({
      documentTypeId: type.id.toLowerCase(),
      name: type.document_name.replace(/\s+/g, " ").trim(),
      required: type.is_mandatory,
      multiple: type.legacy_id === OTHERS_DOCUMENT_LEGACY_ID,
      files: files.filter((file) => file.purpose === "document" && file.document_type_id?.toLowerCase() === type.id.toLowerCase()).map(toFile),
    })),
    dutyFiles: files.filter((file) => file.purpose === "duty_paid").map(toFile),
    letters: (Object.keys(LETTER_KINDS) as LetterKind[]).map((kind) => ({ kind, files: files.filter((file) => file.purpose === kind).map(toFile) })),
  };
}

/**
 * An import an Enterprise user may still upload to or remove files from: theirs, not hidden, in
 * an editable status. Returns its Particular (id, old id), or null.
 */
export async function getEditableImport(
  organisationId: string,
  importId: string,
  editableStatuses: readonly StatusKey[],
): Promise<{ transactionTypeId: string; legacyId: number | null } | null> {
  if (editableStatuses.length === 0) return null;
  const [row] = await db.query<{ transaction_type_id: string; legacy_id: number | null }>`
    SELECT i.transaction_type_id, t.legacy_id
    FROM dbo.imports i
    JOIN dbo.transaction_types t ON t.id = i.transaction_type_id
    WHERE i.id = ${importId} AND i.organisation_id = ${organisationId} AND i.deleted_at IS NULL
      AND i.status_key IN (${editableStatuses})`;
  return row ? { transactionTypeId: row.transaction_type_id.toLowerCase(), legacyId: row.legacy_id } : null;
}

/** One uploaded file of an import, for the download route (which has checked the import's scope). */
export async function getImportDocumentFile(
  importId: string,
  fileId: string,
): Promise<{ originalName: string; storedName: string; contentType: string } | null> {
  const [row] = await db.query<{ original_name: string; stored_name: string; content_type: string }>`
    SELECT original_name, stored_name, content_type FROM dbo.import_documents WHERE id = ${fileId} AND import_id = ${importId}`;
  return row ? { originalName: row.original_name, storedName: row.stored_name, contentType: row.content_type } : null;
}

/**
 * The ids an import form refers to that do not exist (decision log 2026-10-19: no foreign keys, so
 * the writer checks). Field errors, keyed like the form's fields; empty when every reference is
 * found. Inactive rows still count as found: a draft keeps what was chosen before.
 */
export async function checkImportReferences(form: ImportFormData): Promise<Record<string, string>> {
  const lists = {
    country: [form.importCountryId],
    state: [form.importStateId],
    agent: [form.clearingAgentId],
    port: [form.dischargePortId],
    currency: [form.consignmentCurrencyId],
    unit: [form.shipmentUnitId, ...form.items.map((item) => item.unitId)],
    hse: form.items.map((item) => item.hseCodeId),
  };
  const ids = (values: (string | null)[]) => [...new Set(values.filter((value): value is string => Boolean(value)))];
  // One fixed statement per table (table names are never parameters).
  const lookups: Record<keyof typeof lists, (wanted: string[]) => Promise<{ id: string }[]>> = {
    country: (wanted) => db.query`SELECT id FROM dbo.countries WHERE id IN (${wanted})`,
    state: (wanted) => db.query`SELECT id FROM dbo.nigerian_states WHERE id IN (${wanted})`,
    agent: (wanted) => db.query`SELECT id FROM dbo.clearing_agents WHERE id IN (${wanted})`,
    port: (wanted) => db.query`SELECT id FROM dbo.ports WHERE id IN (${wanted})`,
    currency: (wanted) => db.query`SELECT id FROM dbo.currencies WHERE id IN (${wanted})`,
    unit: (wanted) => db.query`SELECT id FROM dbo.measurement_units WHERE id IN (${wanted})`,
    hse: (wanted) => db.query`SELECT id FROM dbo.hse_codes WHERE id IN (${wanted})`,
  };
  const found = async (kind: keyof typeof lists): Promise<Set<string>> => {
    const wanted = ids(lists[kind]);
    if (wanted.length === 0) return new Set();
    return new Set((await lookups[kind](wanted)).map((row) => row.id.toLowerCase()));
  };
  const [country, state, agent, port, currency, unit, hse] = await Promise.all(
    (["country", "state", "agent", "port", "currency", "unit", "hse"] as const).map(found),
  );

  const problems: Record<string, string> = {};
  const unknown = "Not in the list: choose again";
  const check = (value: string | null, known: Set<string>, field: string) => {
    if (value && !known.has(value)) problems[field] = unknown;
  };
  check(form.importCountryId, country, "importCountryId");
  check(form.importStateId, state, "importStateId");
  check(form.clearingAgentId, agent, "clearingAgentId");
  check(form.dischargePortId, port, "dischargePortId");
  check(form.consignmentCurrencyId, currency, "consignmentCurrencyId");
  check(form.shipmentUnitId, unit, "shipmentUnitId");
  form.items.forEach((item, index) => {
    check(item.unitId, unit, `items.${index}.unitId`);
    check(item.hseCodeId, hse, `items.${index}.hseCodeId`);
  });
  return problems;
}

/** The old ids of measurement units, for the unit rules of the import form (Total Tonnes, Shipment Unit). */
export async function getUnitLegacyIds(unitIds: readonly string[]): Promise<Map<string, { legacyId: number | null; kind: string }>> {
  const ids = [...new Set(unitIds)];
  if (ids.length === 0) return new Map();
  const rows = await db.query<{ id: string; legacy_id: number | null; unit_kind: string }>`
    SELECT id, legacy_id, unit_kind FROM dbo.measurement_units WHERE id IN (${ids})`;
  return new Map(rows.map((row) => [row.id.toLowerCase(), { legacyId: row.legacy_id, kind: row.unit_kind }]));
}

/**
 * The Bill of Lading numbers of this list already on another import that is not hidden (old
 * checkExistsBLNo: a BL number belongs to one import). Compared as SQL Server compares text (case-insensitive).
 */
export async function findBlNumbersInUse(importId: string, numbers: readonly string[]): Promise<Set<string>> {
  const wanted = [...new Set(numbers.map((number) => number.trim()).filter(Boolean))];
  if (wanted.length === 0) return new Set();
  const rows = await db.query<{ bl_number: string }>`
    SELECT DISTINCT b.bl_number
    FROM dbo.import_bl_numbers b
    JOIN dbo.imports i ON i.id = b.import_id
    WHERE b.bl_number IN (${wanted}) AND i.id <> ${importId} AND i.deleted_at IS NULL`;
  return new Set(rows.map((row) => row.bl_number.trim().toLowerCase()));
}

/** An import as the View page shows it: every value as text to show, names instead of ids. */
export interface ImportViewDto {
  id: string;
  trackingNumber: string | null;
  status: StatusKey;
  statusReason: string | null;
  createdAt: string;
  submittedAt: string | null;
  enterprise: { name: string; code: string };
  particular: { id: string; name: string; legacyId: number | null };
  invoiceType: "single" | "multiple";
  /** Key information by field key (form.ts KEY_FIELDS): the value to show, "" when empty. */
  keyInfo: Record<string, string>;
  blNumbers: string[];
  invoices: { invoiceNumber: string; invoiceDate: string | null; fobValue: number | null; supplierName: string }[];
  containers: { containerNumber: string; containerSize: string | null; sealNumber: string }[];
  items: {
    itemName: string;
    fobValue: number | null;
    allocatedFreight: number | null;
    allocatedInsurance: number | null;
    cif: number | null;
    ciss: number | null;
    etls: number | null;
    quantity: number | null;
    unit: string | null;
    unitPrice: number | null;
    hseCode: string | null;
    hseDescription: string | null;
    dutyRate: number | null;
    levyRate: number | null;
    exciseRate: number | null;
    vatRate: number | null;
  }[];
}

const decimalOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));
const shownText = (value: unknown): string => (value === null || value === undefined ? "" : String(value));

/**
 * One import for the View page, of any organisation: the caller has already checked that the
 * member may see it (getImport, the list's scope). Null when it does not exist or is hidden.
 */
export async function getImportView(importId: string): Promise<ImportViewDto | null> {
  const [row] = await db.query<{
    id: string;
    tracking_number: string | null;
    status_key: StatusKey;
    status_reason: string | null;
    created_at: Date;
    submitted_at: Date | null;
    company_name: string;
    short_code: string;
    transaction_type_id: string;
    transaction_name: string;
    legacy_id: number | null;
    invoice_type: "single" | "multiple";
    country_name: string | null;
    state_name: string | null;
    agent_name: string | null;
    shipping_mode: string | null;
    port_name: string | null;
    iso_code: string | null;
    currency_name: string | null;
    packing_list_number: string | null;
    freight_value: number | null;
    insurance_value: number | null;
    shipment_quantity: number | null;
    air_quantity: number | null;
    unit_code: string | null;
    total_cbm: number | null;
    total_tonnes: number | null;
    duty_paid: boolean | null;
    duty_reference_number: string | null;
    material_description: string | null;
    consignment_value: number | null;
    invoice_number: string | null;
    container_count: number | null;
  }>`
    SELECT i.id, i.tracking_number, i.status_key, i.status_reason, i.created_at, i.submitted_at,
           o.company_name, o.short_code, i.transaction_type_id, t.transaction_name, t.legacy_id, i.invoice_type,
           c.country_name, s.state_name, a.agent_name, i.shipping_mode, p.port_name, cu.iso_code, cu.currency_name,
           i.packing_list_number, i.freight_value, i.insurance_value, i.shipment_quantity, i.air_quantity, u.unit_code,
           i.total_cbm, i.total_tonnes, i.duty_paid, i.duty_reference_number, i.material_description, i.consignment_value,
           i.invoice_number, i.container_count
    FROM dbo.imports i
    JOIN dbo.organisations o ON o.id = i.organisation_id
    JOIN dbo.transaction_types t ON t.id = i.transaction_type_id
    LEFT JOIN dbo.countries c ON c.id = i.import_country_id
    LEFT JOIN dbo.nigerian_states s ON s.id = i.import_state_id
    LEFT JOIN dbo.clearing_agents a ON a.id = i.clearing_agent_id
    LEFT JOIN dbo.ports p ON p.id = i.discharge_port_id
    LEFT JOIN dbo.currencies cu ON cu.id = i.consignment_currency_id
    LEFT JOIN dbo.measurement_units u ON u.id = i.shipment_unit_id
    WHERE i.id = ${importId} AND i.deleted_at IS NULL`;
  if (!row) return null;

  const [blNumbers, invoices, containers, items] = await Promise.all([
    db.query<{ bl_number: string | null }>`SELECT bl_number FROM dbo.import_bl_numbers WHERE import_id = ${importId} ORDER BY line_number`,
    db.query<{ invoice_number: string | null; invoice_date: string | null; fob_value: number | null; supplier_name: string | null }>`
      SELECT invoice_number, CONVERT(CHAR(10), invoice_date, 23) AS invoice_date, fob_value, supplier_name
      FROM dbo.import_invoices WHERE import_id = ${importId} ORDER BY line_number`,
    db.query<{ container_number: string | null; container_size: string | null; seal_number: string | null }>`
      SELECT container_number, container_size, seal_number FROM dbo.import_containers WHERE import_id = ${importId} ORDER BY line_number`,
    db.query<{
      item_name: string | null;
      fob_value: number | null;
      allocated_freight: number | null;
      allocated_insurance: number | null;
      cif_value: number | null;
      ciss_value: number | null;
      etls_value: number | null;
      quantity: number | null;
      unit_code: string | null;
      unit_price: number | null;
      hse_code: string | null;
      goods_description: string | null;
      import_duty_rate: number | null;
      levy_rate: number | null;
      excise_rate: number | null;
      vat_rate: number | null;
    }>`
      SELECT it.item_name, it.fob_value, it.allocated_freight, it.allocated_insurance, it.cif_value, it.ciss_value, it.etls_value,
             it.quantity, u.unit_code, it.unit_price, h.hse_code, h.goods_description,
             it.import_duty_rate, it.levy_rate, it.excise_rate, it.vat_rate
      FROM dbo.import_items it
      LEFT JOIN dbo.measurement_units u ON u.id = it.unit_id
      LEFT JOIN dbo.hse_codes h ON h.id = it.hse_code_id
      WHERE it.import_id = ${importId}
      ORDER BY it.line_number`,
  ]);

  return {
    id: row.id.toLowerCase(),
    trackingNumber: row.tracking_number,
    status: row.status_key,
    statusReason: row.status_reason,
    createdAt: row.created_at.toISOString(),
    submittedAt: row.submitted_at?.toISOString() ?? null,
    enterprise: { name: row.company_name, code: row.short_code },
    particular: { id: row.transaction_type_id.toLowerCase(), name: row.transaction_name, legacyId: row.legacy_id },
    invoiceType: row.invoice_type,
    keyInfo: {
      importCountryId: shownText(row.country_name),
      importStateId: shownText(row.state_name),
      clearingAgentId: shownText(row.agent_name),
      shippingMode: shownText(row.shipping_mode),
      dischargePortId: shownText(row.port_name),
      consignmentCurrencyId: row.iso_code ? `${row.iso_code} - ${row.currency_name ?? ""}` : "",
      packingListNumber: shownText(row.packing_list_number),
      freightValue: shownText(row.freight_value),
      insuranceValue: shownText(row.insurance_value),
      shipmentQuantity: shownText(row.shipment_quantity),
      airQuantity: shownText(row.air_quantity),
      shipmentUnitId: shownText(row.unit_code),
      totalCbm: shownText(row.total_cbm),
      totalTonnes: shownText(row.total_tonnes),
      dutyPaid: row.duty_paid === null ? "" : row.duty_paid ? "Yes" : "No",
      dutyReferenceNumber: shownText(row.duty_reference_number),
      materialDescription: shownText(row.material_description),
      consignmentValue: shownText(row.consignment_value),
      invoiceNumber: shownText(row.invoice_number),
      containerCount: shownText(row.container_count),
    },
    blNumbers: blNumbers.map((line) => shownText(line.bl_number)).filter(Boolean),
    invoices: invoices.map((line) => ({
      invoiceNumber: shownText(line.invoice_number),
      invoiceDate: line.invoice_date,
      fobValue: decimalOrNull(line.fob_value),
      supplierName: shownText(line.supplier_name),
    })),
    containers: containers.map((line) => ({ containerNumber: shownText(line.container_number), containerSize: line.container_size, sealNumber: shownText(line.seal_number) })),
    items: items.map((line) => ({
      itemName: shownText(line.item_name),
      fobValue: decimalOrNull(line.fob_value),
      allocatedFreight: decimalOrNull(line.allocated_freight),
      allocatedInsurance: decimalOrNull(line.allocated_insurance),
      cif: decimalOrNull(line.cif_value),
      ciss: decimalOrNull(line.ciss_value),
      etls: decimalOrNull(line.etls_value),
      quantity: decimalOrNull(line.quantity),
      unit: line.unit_code,
      unitPrice: decimalOrNull(line.unit_price),
      hseCode: line.hse_code,
      hseDescription: line.goods_description,
      dutyRate: decimalOrNull(line.import_duty_rate),
      levyRate: decimalOrNull(line.levy_rate),
      exciseRate: decimalOrNull(line.excise_rate),
      vatRate: decimalOrNull(line.vat_rate),
    })),
  };
}

/** One step of an import's timeline (0015), oldest first. */
export interface ImportStepDto {
  id: string;
  status: StatusKey;
  decision: string;
  reason: string | null;
  letterDocumentId: string | null;
  actorName: string;
  actorRole: string;
  at: string;
}

export async function listImportSteps(importId: string): Promise<ImportStepDto[]> {
  const rows = await db.query<{
    id: string;
    status_key: StatusKey;
    decision: string;
    reason: string | null;
    letter_document_id: string | null;
    actor_name: string;
    actor_role: string;
    created_at: Date;
  }>`
    SELECT id, status_key, decision, reason, letter_document_id, actor_name, actor_role, created_at
    FROM dbo.import_status_history
    WHERE import_id = ${importId}
    ORDER BY created_at, id`;
  return rows.map((row) => ({
    id: row.id.toLowerCase(),
    status: row.status_key,
    decision: row.decision,
    reason: row.reason,
    letterDocumentId: row.letter_document_id?.toLowerCase() ?? null,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    at: row.created_at.toISOString(),
  }));
}

/** Where each uploaded file of an import is kept and what it is, by file id, for combining them (the caller has checked the scope). */
export async function listImportStoredFiles(importId: string): Promise<Map<string, { storedName: string; contentType: string }>> {
  const rows = await db.query<{ id: string; stored_name: string; content_type: string }>`
    SELECT id, stored_name, content_type FROM dbo.import_documents WHERE import_id = ${importId}`;
  return new Map(rows.map((row) => [row.id.toLowerCase(), { storedName: row.stored_name, contentType: row.content_type }]));
}
