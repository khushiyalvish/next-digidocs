import { describe, expect, it } from "vitest";
import { amount, calculateItems, reconcileItemFobs, round4, shipmentUnitsFor, sumFob, totalTonnes } from "@/features/imports/calculation";
import { importFormSchema, shapeImportForm, type ImportFormSettings } from "@/features/imports/form";
import { applyImportRules } from "@/features/imports/rules";

/* Pins the Add Import calculations and rules against old Import.js / Import_CustomFile.js (decision log 2026-10-19). */

describe("item calculations (full table)", () => {
  it("shares freight and insurance by FOB and works out CIF, CISS, ETLS and unit price", () => {
    const result = calculateItems({
      layout: "full",
      invoiceFob: 1000,
      freight: 100,
      insurance: 50,
      items: [
        { fob: 300, quantity: 10 },
        { fob: 700, quantity: 7 },
      ],
    });
    expect(result.items[0]).toEqual({ allocatedFreight: 30, allocatedInsurance: 15, cif: 345, ciss: 3, etls: 1.725, unitPrice: 34.5 });
    expect(result.items[1]).toEqual({ allocatedFreight: 70, allocatedInsurance: 35, cif: 805, ciss: 7, etls: 4.025, unitPrice: 115 });
    expect(result.totals).toEqual({ fob: 1000, freight: 100, insurance: 50 });
  });

  it("gives the last item with a FOB the rounding remainder, so the shares add up exactly", () => {
    const result = calculateItems({
      layout: "full",
      invoiceFob: 1000,
      freight: 100,
      insurance: 0,
      items: [
        { fob: 333.33, quantity: 1 },
        { fob: 333.33, quantity: 1 },
        { fob: 333.34, quantity: 1 },
      ],
    });
    expect(result.items.map((item) => item.allocatedFreight)).toEqual([33.333, 33.333, 33.334]);
    expect(result.totals.freight).toBe(100);
  });

  it("leaves items without a FOB at 0 and lets the last item WITH a FOB take the remainder", () => {
    const result = calculateItems({
      layout: "full",
      invoiceFob: 1000,
      freight: 100,
      insurance: 10,
      items: [
        { fob: 400, quantity: 0 },
        { fob: 0, quantity: 5 },
      ],
    });
    expect(result.items[0]).toMatchObject({ allocatedFreight: 100, allocatedInsurance: 10, cif: 510, unitPrice: 0 });
    expect(result.items[1]).toEqual({ allocatedFreight: 0, allocatedInsurance: 0, cif: 0, ciss: 0, etls: 0, unitPrice: 0 });
  });

  it("calculates nothing until there is an invoice FOB total", () => {
    const result = calculateItems({ layout: "full", invoiceFob: 0, freight: 100, insurance: 10, items: [{ fob: 50, quantity: 1 }] });
    expect(result.items[0]).toEqual({ allocatedFreight: 0, allocatedInsurance: 0, cif: 0, ciss: 0, etls: 0, unitPrice: 0 });
    expect(result.totals.fob).toBe(50);
  });

  it("keeps 4 decimals", () => {
    expect(round4(1.23456)).toBe(1.2346);
    expect(sumFob([0.1, 0.2])).toBe(0.3);
    expect(amount("1,234.5")).toBe(1234.5);
    expect(amount("")).toBe(0);
    expect(amount("abc")).toBe(0);
  });
});

describe("Local Import / Local Purchase (short table)", () => {
  it("has no freight or insurance, and does not calculate the unit price", () => {
    const result = calculateItems({ layout: "local", invoiceFob: 500, freight: 100, insurance: 10, items: [{ fob: 500, quantity: 2 }] });
    expect(result.items[0]).toEqual({ allocatedFreight: 0, allocatedInsurance: 0, cif: 0, ciss: 0, etls: 0, unitPrice: null });
    expect(result.totals).toEqual({ fob: 500, freight: 0, insurance: 0 });
  });
});

describe("the tiny FOB difference", () => {
  it("moves a difference of at most 0.01 into the last item", () => {
    expect(reconcileItemFobs(1000, [500, 499.995])).toEqual([500, 500]);
    expect(reconcileItemFobs(1000, [500, 500.01])).toEqual([500, 500]);
  });

  it("leaves larger differences, and never makes the last FOB negative", () => {
    expect(reconcileItemFobs(1000, [500, 499.98])).toEqual([500, 499.98]);
    expect(reconcileItemFobs(0.005, [0, 0])).toEqual([0, 0.005]);
    expect(reconcileItemFobs(1000, [])).toEqual([]);
  });
});

describe("Total Tonnes and units", () => {
  it("works out Total Tonnes from KGS (÷ 1000) or TONS", () => {
    expect(totalTonnes(2500, 1)).toBe(2.5);
    expect(totalTonnes(1234, 1)).toBe(1.234);
    expect(totalTonnes(3, 32)).toBe(3);
    expect(totalTonnes(5, 16)).toBeNull();
    expect(totalTonnes(null, 1)).toBeNull();
  });

  it("offers liquid units to Dry and Liquid Bulk, KGS and TONS to Local Import, solid units otherwise", () => {
    const units = [
      { id: "kgs", kind: "solid", legacyId: 1 },
      { id: "mt", kind: "solid", legacyId: 2 },
      { id: "ltrs", kind: "liquid", legacyId: 16 },
      { id: "tons", kind: "solid", legacyId: 32 },
    ];
    expect(shipmentUnitsFor(1, units).map((unit) => unit.id)).toEqual(["ltrs"]);
    expect(shipmentUnitsFor(2, units).map((unit) => unit.id)).toEqual(["ltrs"]);
    expect(shipmentUnitsFor(8, units).map((unit) => unit.id)).toEqual(["kgs", "tons"]);
    expect(shipmentUnitsFor(3, units).map((unit) => unit.id)).toEqual(["kgs", "mt", "tons"]);
  });
});

describe("the rules applied before storing", () => {
  const IMPORT_ID = "0a000000-0000-4000-8000-000000000001";
  const KGS = "0a000000-0000-4000-8000-0000000000a1";
  const LITRES = "0a000000-0000-4000-8000-0000000000a2";
  const units = new Map([
    [KGS, { legacyId: 1, kind: "solid" }],
    [LITRES, { legacyId: 16, kind: "liquid" }],
  ]);
  const settings = (legacyId: number, keys: string[]): ImportFormSettings => ({
    legacyId,
    keyFields: keys.map((fieldKey) => ({ fieldKey, label: fieldKey, required: true })),
  });
  const parse = (raw: Record<string, string | string[]>) => importFormSchema.parse(shapeImportForm({ importId: IMPORT_ID, intent: "draft", ...raw }));
  const apply = (raw: Record<string, string | string[]>, legacyId: number, keys: string[], submit = false, inUse = new Set<string>()) =>
    applyImportRules({ form: parse(raw), settings: settings(legacyId, keys), units, blNumbersInUse: inUse, submit });

  it("refuses a Shipment Unit that is not the Particular's", () => {
    expect(apply({ shipmentUnitId: KGS }, 1, ["shipmentUnitId"]).problems.shipmentUnitId).toBeDefined();
    expect(apply({ shipmentUnitId: LITRES }, 1, ["shipmentUnitId"]).problems.shipmentUnitId).toBeUndefined();
  });

  it("works out Local Import's Total Tonnes, whatever was posted", () => {
    const result = apply({ shipmentQuantity: "2,500", shipmentUnitId: KGS, totalTonnes: "999" }, 8, ["shipmentQuantity", "shipmentUnitId", "totalTonnes"]);
    expect(result.form.totalTonnes).toBe(2.5);
    expect(apply({ totalTonnes: "7" }, 2, ["totalTonnes"]).form.totalTonnes).toBe(7); // typed elsewhere
  });

  it("refuses a BL number entered twice or already on another import", () => {
    const result = apply({ blNumber: ["BL1", "bl1", "BL9"] }, 1, ["blNumbers"], false, new Set(["bl9"]));
    expect(result.problems["blNumbers.1"]).toBe("Already entered above");
    expect(result.problems["blNumbers.2"]).toBe("Already used on another import");
  });

  it("stores the server's own calculation, not the posted unit price, on the full table", () => {
    const result = apply(
      { freightValue: "100", insuranceValue: "50", invoiceNo: ["I1"], invoiceFob: ["1000"], itemName: ["A"], itemFob: ["1000"], itemQuantity: ["10"], itemUnitPrice: ["1"] },
      1,
      [],
    );
    expect(result.itemValues[0]).toMatchObject({ allocatedFreight: 100, allocatedInsurance: 50, cif: 1150, unitPrice: 115 });
    expect(result.form.items[0].unitPrice).toBe(115);
  });

  it("keeps the entered unit price on the short table", () => {
    const result = apply({ invoiceNo: ["I1"], invoiceFob: ["10"], itemName: ["A"], itemFob: ["10"], itemQuantity: ["2"], itemUnitPrice: ["4.5"] }, 9, []);
    expect(result.form.items[0].unitPrice).toBe(4.5);
  });

  it("on Submit: absorbs a difference of at most 0.01, refuses a larger one; a draft is never refused for it", () => {
    const close = { invoiceNo: ["I1"], invoiceFob: ["1000"], itemName: ["A", "B"], itemFob: ["500", "499.995"], itemQuantity: ["1", "1"] };
    const submitted = apply(close, 1, [], true);
    expect(submitted.problems.itemFobTotal).toBeUndefined();
    expect(submitted.form.items[1].fobValue).toBe(500);

    const far = { ...close, itemFob: ["500", "400"] };
    expect(apply(far, 1, [], true).problems.itemFobTotal).toBe("The item FOB total (900.00) must equal the invoice FOB total (1,000.00).");
    expect(apply(far, 1, [], false).problems.itemFobTotal).toBeUndefined();
  });
});
