import { amount, calculateItems, reconcileItemFobs, sameAmount, shipmentUnitsFor, sumFob, totalTonnes, totalTonnesIsCalculated, type ItemValues } from "@/features/imports/calculation";
import { itemLayoutFor, keyFieldsFor, type ImportFormData, type ImportFormSettings } from "@/features/imports/form";

/*
 * The old form's rules applied to a posted import before it is stored (decision log 2026-10-19):
 * what the old browser code worked out or refused, done again on the server.
 *
 *   - Shipment Unit must be one of the Particular's units (liquid for Dry / Liquid Bulk, KGS or
 *     TONS for Local Import, solid otherwise).
 *   - Local Import's Total Tonnes is worked out from Shipment Qty and its unit, never typed.
 *   - A BL number appears once in the form, and is not on another import (not hidden).
 *   - Item values (allocated freight / insurance, CIF, CISS, ETLS, unit price) are calculated here,
 *     whatever the browser showed.
 *   - Submit: a difference of at most 0.01 between the item and invoice FOB totals goes into the
 *     last item's FOB; then the two totals must be equal.
 *
 * Refusals that would store something wrong (a unit, a BL number) block a draft too; the FOB
 * totals only block Submit. Pure: the caller reads units and BL numbers in use from the database.
 */

export interface RulesResult {
  form: ImportFormData;
  itemValues: ItemValues[];
  problems: Record<string, string>;
}

const formatTotal = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export function applyImportRules(input: {
  form: ImportFormData;
  settings: ImportFormSettings;
  /** Old id and kind of every unit the form refers to. */
  units: ReadonlyMap<string, { legacyId: number | null; kind: string }>;
  /** BL numbers (lower-cased) already on another import. */
  blNumbersInUse: ReadonlySet<string>;
  submit: boolean;
}): RulesResult {
  const { settings, units, blNumbersInUse, submit } = input;
  const legacyId = settings.legacyId;
  const problems: Record<string, string> = {};
  let form = input.form;

  // Shipment Unit: one of the Particular's units.
  if (form.shipmentUnitId) {
    const unit = units.get(form.shipmentUnitId);
    if (!unit || shipmentUnitsFor(legacyId, [unit]).length === 0) problems.shipmentUnitId = "Choose one of this Particular's units";
  }

  // Total Tonnes: worked out for Local Import.
  if (totalTonnesIsCalculated(legacyId) && keyFieldsFor(settings).some((field) => field.key === "totalTonnes")) {
    const unitLegacyId = form.shipmentUnitId ? (units.get(form.shipmentUnitId)?.legacyId ?? null) : null;
    form = { ...form, totalTonnes: totalTonnes(form.shipmentQuantity, unitLegacyId) };
  }

  // BL numbers: once in the form, and on no other import.
  const seen = new Set<string>();
  form.blNumbers.forEach((value, index) => {
    const key = value?.trim().toLowerCase();
    if (!key) return;
    if (seen.has(key)) problems[`blNumbers.${index}`] = "Already entered above";
    else if (blNumbersInUse.has(key)) problems[`blNumbers.${index}`] = "Already used on another import";
    seen.add(key);
  });

  // FOB: the invoice total, a tiny difference absorbed by the last item on Submit.
  const invoiceFob = sumFob(form.invoices.map((invoice) => amount(invoice.fobValue)));
  if (submit && form.items.length > 0 && form.items.every((item) => item.fobValue !== null)) {
    const fobs = reconcileItemFobs(invoiceFob, form.items.map((item) => amount(item.fobValue)));
    form = { ...form, items: form.items.map((item, index) => ({ ...item, fobValue: fobs[index] })) };
  }

  const layout = itemLayoutFor(legacyId);
  const calculation = calculateItems({
    layout,
    invoiceFob,
    freight: amount(form.freightValue),
    insurance: amount(form.insuranceValue),
    items: form.items.map((item) => ({ fob: amount(item.fobValue), quantity: amount(item.quantity) })),
  });

  if (submit && form.items.length > 0 && !sameAmount(invoiceFob, calculation.totals.fob)) {
    problems.itemFobTotal = `The item FOB total (${formatTotal(calculation.totals.fob)}) must equal the invoice FOB total (${formatTotal(invoiceFob)}).`;
  }

  // The full table's unit price is calculated; the short table keeps what was entered.
  if (layout === "full") {
    form = { ...form, items: form.items.map((item, index) => ({ ...item, unitPrice: calculation.items[index].unitPrice })) };
  }

  return { form, itemValues: calculation.items, problems };
}
