import "server-only";
import { readFileSync } from "node:fs";
import type { Db } from "@/lib/db";
import type { SeededPerson } from "@/features/auth/test-user-seed";
import { importFormSchema, normaliseForParticular, submitProblems, type ImportFormSettings } from "@/features/imports/form";
import { findImportIdByTrackingNumber, getUnitLegacyIds } from "@/features/imports/queries";
import { applyImportRules } from "@/features/imports/rules";
import { backdateSampleImport, createImport, moveImportStatus, recordImportStep, saveImportForm } from "@/features/imports/writes";
import { listTransactionTypeKeyFields } from "@/features/reference/queries";
import { statusesAllowing } from "@/features/workflow/actions";
import { reviewStep } from "@/features/workflow/review";
import type { StatusKey } from "@/features/workflow/statuses";
import { SAMPLE_DATA_FILE, SAMPLE_PATHS, sampleDataFileSchema, type SampleImport, type SampleShipment } from "@/features/sample-data/schemas";

/*
 * Loads DigiDocs's sample data (hub CHILD-APP-GUIDE.md §5.10): the imports in
 * database/seed/sample-data.json, each created, filled in, submitted and reviewed through the
 * same writers and form rules the pages use, then moved back in time. Run by `npm run db:seed`,
 * in its transaction, after the test users. Idempotent: an import whose SAMPLE- tracking number
 * exists is left as it is. No uploaded files (sample imports have no documents or letters), and
 * no audit events: the audit log records what people did, and is never fabricated.
 */

/** What the seed did. */
export interface SampleDataResult {
  created: number;
  skipped: number;
}

interface ShipmentIds {
  transactionTypeId: string;
  countryId: string;
  portId: string;
  clearingAgentId: string;
  currencyId: string;
  units: Map<number, string>;
  hseCodes: Map<string, string>;
}

async function oneId(rows: Promise<{ id: string }[]>, what: string): Promise<string> {
  const found = await rows;
  if (found.length !== 1) throw new Error(`Sample data: ${what} is not in the reference lists (migrations 0004-0005).`);
  return found[0].id.toLowerCase();
}

/** The database ids of what a shipment names by old id or code. Reference data only. */
async function shipmentIds(tx: Db, shipment: SampleShipment): Promise<ShipmentIds> {
  const units = new Map<number, string>();
  const hseCodes = new Map<string, string>();
  for (const item of shipment.items) {
    units.set(item.unitLegacyId, await oneId(tx.query`SELECT id FROM dbo.measurement_units WHERE legacy_id = ${item.unitLegacyId}`, `unit ${item.unitLegacyId}`));
    hseCodes.set(item.hseCode, await oneId(tx.query`SELECT id FROM dbo.hse_codes WHERE hse_code = ${item.hseCode}`, `HSE code ${item.hseCode}`));
  }
  return {
    transactionTypeId: await oneId(
      tx.query`SELECT id FROM dbo.transaction_types WHERE legacy_id = ${shipment.particularLegacyId} AND direction = 'import' AND is_active = 1`,
      `active import Particular ${shipment.particularLegacyId}`,
    ),
    countryId: await oneId(tx.query`SELECT id FROM dbo.countries WHERE legacy_id = ${shipment.countryLegacyId}`, `country ${shipment.countryLegacyId}`),
    portId: await oneId(tx.query`SELECT id FROM dbo.ports WHERE legacy_id = ${shipment.portLegacyId}`, `port ${shipment.portLegacyId}`),
    clearingAgentId: await oneId(
      tx.query`SELECT id FROM dbo.clearing_agents WHERE legacy_id = ${shipment.clearingAgentLegacyId}`,
      `clearing agent ${shipment.clearingAgentLegacyId}`,
    ),
    currencyId: await oneId(tx.query`SELECT id FROM dbo.currencies WHERE iso_code = ${shipment.currency}`, `currency ${shipment.currency}`),
    units,
    hseCodes,
  };
}

/** A date `daysAgo` days back, as SQL Server's clock has it (YYYY-MM-DD). */
async function dateDaysAgo(tx: Db, daysAgo: number): Promise<string> {
  const [row] = await tx.query<{ day: string }>`SELECT CONVERT(CHAR(10), DATEADD(DAY, -${daysAgo}, SYSDATETIMEOFFSET()), 23) AS day`;
  return row.day;
}

/** The form an Enterprise user would have filled in for this sample, read the way the page's form is. */
function sampleForm(sample: SampleImport, shipment: SampleShipment, ids: ShipmentIds, importId: string, invoiceDate: string) {
  const digits = sample.trackingNumber.slice(-4);
  const total = shipment.items.reduce((sum, item) => sum + item.fob, 0);
  return importFormSchema.parse({
    importId,
    intent: sample.status === "draft" ? "draft" : "submit",
    invoiceType: "single",
    importCountryId: ids.countryId,
    importStateId: null,
    clearingAgentId: ids.clearingAgentId,
    shippingMode: shipment.shippingMode,
    dischargePortId: ids.portId,
    consignmentCurrencyId: ids.currencyId,
    packingListNumber: `${sample.trackingNumber}-PL`,
    freightValue: shipment.freight,
    insuranceValue: shipment.insurance,
    shipmentQuantity: null,
    airQuantity: shipment.airQuantity,
    shipmentUnitId: null,
    totalCbm: shipment.totalCbm,
    totalTonnes: null,
    dutyPaid: null,
    dutyReferenceNumber: null,
    materialDescription: shipment.description,
    consignmentValue: total,
    invoiceNumber: `${sample.trackingNumber}-INV`,
    containerCount: shipment.containerSizes.length || null,
    blNumbers: [`${sample.trackingNumber}-BL`],
    invoices: [{ invoiceNumber: `${sample.trackingNumber}-INV`, invoiceDate, fobValue: total, supplierName: shipment.supplier }],
    containers: shipment.containerSizes.map((size, index) => ({
      containerNumber: `SMPU${digits}${String(index + 1).padStart(3, "0")}`,
      containerSize: size,
      sealNumber: `${sample.trackingNumber}-S${index + 1}`,
    })),
    items: shipment.items.map((item) => ({
      itemName: item.name,
      fobValue: item.fob,
      quantity: item.quantity,
      unitId: ids.units.get(item.unitLegacyId),
      unitPrice: null,
      hseCodeId: ids.hseCodes.get(item.hseCode),
    })),
  });
}

/** Loads the sample imports that are missing. `people`: the test users just seeded, in the same transaction. */
export async function seedSampleData(tx: Db, people: readonly SeededPerson[]): Promise<SampleDataResult> {
  const file = sampleDataFileSchema.parse(JSON.parse(readFileSync(SAMPLE_DATA_FILE, "utf8")));
  const reviewers = {
    lfz_admin: people.find((person) => person.role === "lfz_admin"),
    nepza: people.find((person) => person.role === "nepza"),
  };
  const actor = (person: SeededPerson) => ({ id: person.accountId, name: person.fullName, role: person.role ?? "" });
  const editable = statusesAllowing("import", "enterprise", "edit");
  const result: SampleDataResult = { created: 0, skipped: 0 };

  for (const sample of file.imports) {
    const fail = (problem: string) => new Error(`Sample data ${sample.trackingNumber}: ${problem}`);
    if (await findImportIdByTrackingNumber(tx, sample.trackingNumber)) {
      result.skipped += 1;
      continue;
    }
    const owner = people.find((person) => person.hubId.toLowerCase() === sample.ownerId);
    if (!owner || owner.role !== "enterprise" || !owner.organisationId) throw fail("its owner is not an Enterprise user in test-users.json.");
    const shipment = file.shipments[sample.shipment];
    const ids = await shipmentIds(tx, shipment);

    // Start it, as "Add Import" does.
    const created = await createImport(tx, {
      organisationId: owner.organisationId,
      accountId: owner.accountId,
      transactionTypeId: ids.transactionTypeId,
      trackingNumber: sample.trackingNumber,
    });
    if (!created) throw fail("its organisation or Particular is not active.");
    await recordImportStep(tx, { importId: created.id, statusKey: "draft", decision: "created", actor: actor(owner) });

    // Fill it in and save or submit it, with the page's rules (reference reads only, outside this transaction).
    const settings: ImportFormSettings = { legacyId: shipment.particularLegacyId, keyFields: await listTransactionTypeKeyFields(ids.transactionTypeId) };
    const submit = sample.status !== "draft";
    const normalised = normaliseForParticular(sampleForm(sample, shipment, ids, created.id, await dateDaysAgo(tx, sample.daysAgo + 7)), settings);
    const units = await getUnitLegacyIds(normalised.items.map((item) => item.unitId).filter((id): id is string => Boolean(id)));
    // Sample BL numbers carry the tracking number, so none is on another import.
    const { form, itemValues, problems } = applyImportRules({ form: normalised, settings, units, blNumbersInUse: new Set(), submit });
    const allProblems = { ...problems, ...(submit ? submitProblems(form, settings) : {}) };
    if (Object.keys(allProblems).length > 0) throw fail(`the form is refused: ${JSON.stringify(allProblems)}`);
    if (!(await saveImportForm(tx, { organisationId: owner.organisationId, editableStatuses: editable, form, itemValues, submit }))) {
      throw fail("it could not be saved.");
    }

    let status: StatusKey = "draft";
    if (submit) {
      status = "submitted";
      await recordImportStep(tx, { importId: created.id, statusKey: status, decision: "submitted", actor: actor(owner) });
    }

    // Review it, step by step, as LFZ and NEPZA would.
    for (const review of SAMPLE_PATHS[sample.status]) {
      const step = reviewStep(review.role, status, review.decision);
      const reviewer = reviewers[review.role];
      if (!step) throw fail(`${review.role} cannot ${review.decision} at ${status}.`);
      if (!reviewer) throw fail(`nobody in test-users.json has the role ${review.role}.`);
      const reason = step.reasonRequired ? sample.reason : null;
      if (!(await moveImportStatus(tx, { importId: created.id, fromStatus: status, toStatus: step.to, reason }))) throw fail(`it did not move to ${step.to}.`);
      await recordImportStep(tx, { importId: created.id, statusKey: step.to, decision: review.decision, reason, actor: actor(reviewer) });
      status = step.to;
    }
    if (status !== sample.status) throw fail(`it ended at ${status}, not ${sample.status}.`);

    if (!(await backdateSampleImport(tx, { importId: created.id, daysAgo: sample.daysAgo }))) throw fail("it could not be moved back in time.");
    result.created += 1;
  }
  return result;
}
