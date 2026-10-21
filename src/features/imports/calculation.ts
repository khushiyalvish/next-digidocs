/*
 * The Add Import calculations, as old ViewFormJS/ImpExp/Import.js and Import_CustomFile.js did
 * them (decision log 2026-10-19). One module for both sides: the form shows these values live, and
 * the server calculates them again from the posted inputs before storing, so what is stored never
 * depends on the browser.
 *
 *   Invoice FOB total   the sum of the invoices' FOB.
 *   Allocated freight   item FOB ÷ invoice FOB total × the key information's Freight; the same
 *   / insurance         for Insurance. Only items with a FOB share; the last of them takes the
 *                       rounding remainder, so the shares add up to the totals exactly.
 *   CIF                 FOB + allocated freight + allocated insurance.
 *   CISS                1% of FOB.            ETLS   0.5% of CIF.
 *   Unit price          CIF ÷ quantity (0 without a quantity).
 *   Local Import / Local Purchase (old 8, 9): no freight or insurance; the unit price is entered.
 *   Duty %, LVY %, EXC %, VAT %: the HSE code's rates, shown and stored as rates — the old form
 *   never calculated amounts (owner's choice: rates only).
 *
 * Calculated at 4 decimals, shown with 2. Submit requires the item FOB total to equal the invoice
 * FOB total; a difference of at most 0.01 is absorbed by the last item's FOB first.
 *
 * Pure: no database, no browser.
 */

import type { ItemLayout } from "@/features/imports/form";

export const round4 = (value: number) => Math.round((value + Number.EPSILON) * 10000) / 10000;

/** Two amounts are the same at 4 decimals. */
export const sameAmount = (a: number, b: number) => Math.abs(a - b) <= 0.0001;

/** A typed amount ("1,234.5") as a number; empty or not a number counts as 0. */
export function amount(text: string | number | null | undefined): number {
  if (typeof text === "number") return Number.isFinite(text) ? text : 0;
  if (!text || !text.trim()) return 0;
  const number = Number(text.replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : 0;
}

export function sumFob(fobs: readonly number[]): number {
  return round4(fobs.reduce((sum, fob) => sum + fob, 0));
}

export interface ItemValues {
  allocatedFreight: number;
  allocatedInsurance: number;
  cif: number;
  ciss: number;
  etls: number;
  /** null on the short table: there the unit price is entered, not calculated. */
  unitPrice: number | null;
}

export interface ItemCalculation {
  items: ItemValues[];
  totals: { fob: number; freight: number; insurance: number };
}

const ZERO: ItemValues = { allocatedFreight: 0, allocatedInsurance: 0, cif: 0, ciss: 0, etls: 0, unitPrice: 0 };

/** Every item's calculated values and the footer totals (old calculateFreightInsurance, calculateUnitPrice, calculateFooterTotals). */
export function calculateItems(input: {
  layout: ItemLayout;
  invoiceFob: number;
  freight: number;
  insurance: number;
  items: readonly { fob: number; quantity: number }[];
}): ItemCalculation {
  const fobTotal = sumFob(input.items.map((item) => item.fob));

  // Local Import / Local Purchase: FOB only (old calculateParticular89Totals).
  if (input.layout === "local") {
    return { items: input.items.map(() => ({ ...ZERO, unitPrice: null })), totals: { fob: fobTotal, freight: 0, insurance: 0 } };
  }

  const freightTotal = round4(input.freight);
  const insuranceTotal = round4(input.insurance);
  const values: ItemValues[] = input.items.map(() => ({ ...ZERO }));
  const sharing = input.items.map((item, index) => ({ ...item, index })).filter((item) => item.fob > 0);

  if (input.invoiceFob > 0 && sharing.length > 0) {
    let usedFreight = 0;
    let usedInsurance = 0;
    sharing.forEach((item, position) => {
      const last = position === sharing.length - 1;
      const freight = last ? round4(freightTotal - usedFreight) : round4((item.fob / input.invoiceFob) * freightTotal);
      const insurance = last ? round4(insuranceTotal - usedInsurance) : round4((item.fob / input.invoiceFob) * insuranceTotal);
      usedFreight = round4(usedFreight + freight);
      usedInsurance = round4(usedInsurance + insurance);
      const cif = round4(item.fob + freight + insurance);
      values[item.index] = {
        allocatedFreight: freight,
        allocatedInsurance: insurance,
        cif,
        ciss: round4(item.fob * 0.01),
        etls: round4(cif * 0.005),
        unitPrice: item.quantity > 0 ? round4(cif / item.quantity) : 0,
      };
    });
  }

  return {
    items: values,
    totals: {
      fob: fobTotal,
      freight: round4(values.reduce((sum, value) => sum + value.allocatedFreight, 0)),
      insurance: round4(values.reduce((sum, value) => sum + value.allocatedInsurance, 0)),
    },
  };
}

/**
 * The item FOBs with a tiny difference to the invoice FOB total (at most 0.01) moved into the last
 * item (old reconcileItemFobRounding). Larger differences are left for Submit to refuse.
 */
export function reconcileItemFobs(invoiceFob: number, fobs: readonly number[]): number[] {
  if (fobs.length === 0 || invoiceFob <= 0) return [...fobs];
  const difference = round4(invoiceFob - sumFob(fobs));
  if (difference === 0 || Math.abs(difference) > 0.01) return [...fobs];
  const last = round4(fobs[fobs.length - 1] + difference);
  return last < 0 ? [...fobs] : [...fobs.slice(0, -1), last];
}

/** The old ids of the units Total Tonnes understands: 1 KGS, 32 TONS. */
export const KGS_UNIT_LEGACY_ID = 1;
export const TONS_UNIT_LEGACY_ID = 32;

/** Total Tonnes from Shipment Qty and its unit (old updateTotalTonnes): KGS ÷ 1000, TONS as is; otherwise null (not worked out). */
export function totalTonnes(quantity: number | null, unitLegacyId: number | null): number | null {
  if (quantity === null || !Number.isFinite(quantity)) return null;
  if (unitLegacyId === KGS_UNIT_LEGACY_ID) return Math.round((quantity / 1000) * 1000) / 1000;
  if (unitLegacyId === TONS_UNIT_LEGACY_ID) return quantity;
  return null;
}

/** Only Local Import has Total Tonnes worked out and not typed (old: read-only for Particular 8). */
export const totalTonnesIsCalculated = (particularLegacyId: number | null) => particularLegacyId === 8;

/**
 * The units a Particular's Shipment Unit offers (old setUnitDDL): liquid units for Dry and Liquid
 * Bulk (1, 2), only KGS and TONS for Local Import (8), solid units otherwise.
 */
export function shipmentUnitsFor<T extends { kind: string; legacyId: number | null }>(particularLegacyId: number | null, units: readonly T[]): T[] {
  if (particularLegacyId === 8) return units.filter((unit) => unit.legacyId === KGS_UNIT_LEGACY_ID || unit.legacyId === TONS_UNIT_LEGACY_ID);
  const kind = particularLegacyId === 1 || particularLegacyId === 2 ? "liquid" : "solid";
  return units.filter((unit) => unit.kind === kind);
}
