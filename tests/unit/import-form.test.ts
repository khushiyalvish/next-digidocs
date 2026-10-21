import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  blLineLabel,
  blNumbersFor,
  defaultShippingMode,
  hasContainers,
  importFormSchema,
  itemLayoutFor,
  KEY_FIELDS,
  keyFieldsFor,
  normaliseForParticular,
  shapeImportForm,
  submitProblems,
  type ImportFormData,
  type ImportFormSettings,
} from "@/features/imports/form";

/* Pins the Add Import form rules (src/features/imports/form.ts) against the settings of migration 0010. */

const IMPORT_ID = "0a000000-0000-4000-8000-000000000001";
const UNIT = "0a000000-0000-4000-8000-000000000002";
const HSE = "0a000000-0000-4000-8000-000000000003";

// ---- The settings, read from migration 0010 (copied from the old Map_KeyInputParticular) -----------

const migration = readFileSync(join(process.cwd(), "database", "migrations", "0010_key_info_fields.sql"), "utf8");
const fieldKeys = new Map(
  [...migration.matchAll(/^\s+\((\d+), '(import|export)', '(\w+)', N'[^']*', [01]\)[,;]$/gm)].map((match) => [Number(match[1]), { direction: match[2], key: match[3] }]),
);
const particularRows = [...migration.matchAll(/^\s+\((\d+), (\d+), (\d+), N'((?:[^']|'')*)', ([01]), ([01])\),?$/gm)].map((match) => ({
  fieldLegacyId: Number(match[2]),
  particular: Number(match[3]),
  label: match[4].replace(/''/g, "'"),
  required: match[5] === "1",
  active: match[6] === "1",
}));

function settingsFor(particular: number): ImportFormSettings {
  return {
    legacyId: particular,
    keyFields: particularRows
      .filter((row) => row.particular === particular && row.active)
      .map((row) => ({ fieldKey: fieldKeys.get(row.fieldLegacyId)!.key, label: row.label, required: row.required })),
  };
}

function parse(raw: Record<string, string | string[]>): ImportFormData {
  return importFormSchema.parse(shapeImportForm({ importId: IMPORT_ID, intent: "draft", ...raw }));
}

describe("migration 0010 (key-information settings)", () => {
  it("has all 46 old fields and 95 Particular rows", () => {
    expect(fieldKeys.size).toBe(46);
    expect(particularRows).toHaveLength(95);
  });

  it("names only import fields the form knows (or handles elsewhere)", () => {
    const known = new Set<string>([...KEY_FIELDS.map((field) => field.key), "blNumbers", "supplierName", "dutyPaidFile"]);
    for (const [legacyId, field] of fieldKeys) if (field.direction === "import") expect(known.has(field.key), `${legacyId} ${field.key}`).toBe(true);
    for (const field of KEY_FIELDS) expect([...fieldKeys.values()].some((each) => each.key === field.key && each.direction === "import"), field.key).toBe(true);
  });
});

describe("what a Particular shows", () => {
  it("shows each import Particular's own key fields, with its labels, in the old form's order", () => {
    expect(keyFieldsFor(settingsFor(9)).map((field) => [field.key, field.label])).toEqual([
      ["importStateId", "State of Origin"],
      ["shippingMode", "Shipping Mode"],
      ["consignmentCurrencyId", "Consignment Currency"],
      ["shipmentQuantity", "Shipment Quantity"],
      ["shipmentUnitId", "Unit of Measurement"],
    ]);
    expect(keyFieldsFor(settingsFor(17)).map((field) => field.key)).toEqual([
      "importCountryId",
      "clearingAgentId",
      "shippingMode",
      "dischargePortId",
      "consignmentCurrencyId",
      "packingListNumber",
      "freightValue",
      "insuranceValue",
      "airQuantity",
      "totalCbm",
      "materialDescription",
    ]);
    expect(keyFieldsFor(settingsFor(8)).map((field) => field.key)).toContain("dutyReferenceNumber");
    expect(keyFieldsFor(settingsFor(3)).map((field) => field.key)).not.toContain("shipmentQuantity");
    expect(keyFieldsFor({ legacyId: 7, keyFields: [] })).toEqual([]);
  });

  it("labels the Bill of Lading section per Particular; only Dry and Liquid Bulk may add more", () => {
    expect(blNumbersFor(settingsFor(17))).toEqual({ label: "Air Waybill No.", required: true, multiple: false });
    expect(blNumbersFor(settingsFor(9))?.label).toBe("Purchase Order");
    expect(blNumbersFor(settingsFor(1))?.multiple).toBe(true);
    expect(blNumbersFor(settingsFor(2))?.multiple).toBe(true);
    expect(blNumbersFor(settingsFor(3))?.multiple).toBe(false);
    expect(blLineLabel("Bill of Lading No. 1(Bill No.)", 3)).toBe("Bill of Lading No. 3(Bill No.)");
    expect(blLineLabel("Bill of Lading No. 1 (BL No.)", 2)).toBe("Bill of Lading No. 2 (BL No.)");
    expect(blLineLabel("Air Waybill No.", 1)).toBe("Air Waybill No.");
  });

  it("gives Local Import (8) and Local Purchase (9) the short item table, everyone else the full one", () => {
    expect(itemLayoutFor(8)).toBe("local");
    expect(itemLayoutFor(9)).toBe("local");
    for (const id of [1, 2, 3, 17, null]) expect(itemLayoutFor(id)).toBe("full");
  });

  it("shows containers only for Sea Container Import (3)", () => {
    expect(hasContainers(3)).toBe(true);
    for (const id of [1, 2, 8, 9, 17, null]) expect(hasContainers(id)).toBe(false);
  });

  it("chooses the old form's shipping mode", () => {
    expect(defaultShippingMode(17)).toBe("air");
    expect(defaultShippingMode(8)).toBe("road");
    expect(defaultShippingMode(3)).toBe("sea");
    expect(defaultShippingMode(1)).toBeNull();
  });
});

describe("reading the posted form", () => {
  it("saves an empty draft: nothing filled in is not an error", () => {
    const form = parse({});
    expect(form.invoiceType).toBe("single");
    expect(form.blNumbers).toEqual([]);
    for (const field of KEY_FIELDS) expect(form[field.key], field.key).toBeNull();
  });

  it("puts parallel lists back into lines, and reads numbers with thousands separators", () => {
    const form = parse({ itemName: ["Rice", "Beans"], itemFob: ["1,250.50", ""], itemUnit: [UNIT, ""], itemHse: [HSE, ""], freightValue: "2,000", dutyPaid: "yes" });
    expect(form.items[0]).toMatchObject({ itemName: "Rice", fobValue: 1250.5, unitId: UNIT, hseCodeId: HSE });
    expect(form.items[1]).toMatchObject({ itemName: "Beans", fobValue: null, unitId: null });
    expect(form.freightValue).toBe(2000);
    expect(form.dutyPaid).toBe(true);
  });

  it("refuses malformed values even in a draft, and more than 10 BL numbers", () => {
    const tries: Record<string, string | string[]>[] = [{ freightValue: "abc" }, { itemFob: "-1" }, { itemUnit: "not-an-id" }, { blNumber: Array.from({ length: 11 }, (_, i) => `BL${i}`) }];
    for (const raw of tries) expect(importFormSchema.safeParse(shapeImportForm({ importId: IMPORT_ID, intent: "draft", ...raw })).success, JSON.stringify(raw)).toBe(false);
  });

  it("keeps only what the Particular shows", () => {
    const posted = parse({ freightValue: "10", airQuantity: "5", blNumber: ["A", "B"], invoiceType: "single", invoiceNo: ["X", "Y"], containerNumber: ["C1"] });
    const air = normaliseForParticular(posted, settingsFor(17));
    expect(air.freightValue).toBe(10);
    expect(air.airQuantity).toBe(5);
    expect(air.blNumbers).toEqual(["A"]); // one Air Waybill No.
    expect(air.invoices).toHaveLength(1);
    expect(air.containers).toHaveLength(0);
    const purchase = normaliseForParticular(posted, settingsFor(9));
    expect(purchase.freightValue).toBeNull(); // Local Purchase has no freight
    expect(normaliseForParticular(posted, settingsFor(1)).blNumbers).toEqual(["A", "B"]);
    expect(normaliseForParticular(posted, settingsFor(3)).containers).toHaveLength(1);
  });
});

describe("what Submit requires", () => {
  it("names every missing field the Particular shows, with its label, and nothing else", () => {
    const problems = submitProblems(parse({}), settingsFor(9));
    expect(problems.importStateId).toBe("State of Origin is required");
    expect(problems.shipmentUnitId).toBe("Unit of Measurement is required");
    expect(problems.freightValue).toBeUndefined();
    expect(problems["blNumbers.0"]).toBe("Purchase Order is required");
    expect(problems.invoices).toBeDefined();
    expect(problems.items).toBeDefined();
    expect(problems.containers).toBeUndefined();
    expect(submitProblems(parse({}), settingsFor(3)).containers).toBeDefined();
  });

  it("asks for the duty reference only when the duty was paid", () => {
    expect(submitProblems(parse({ dutyPaid: "no" }), settingsFor(8)).dutyReferenceNumber).toBeUndefined();
    expect(submitProblems(parse({ dutyPaid: "yes" }), settingsFor(8)).dutyReferenceNumber).toBeDefined();
  });

  it("checks every cell of every line, and the unit price only on the short item table", () => {
    const form = parse({ invoiceNo: [""], itemName: ["Rice"], itemFob: ["10"], itemQuantity: ["1"], itemUnit: [UNIT], itemHse: [HSE] });
    const full = submitProblems(form, settingsFor(1));
    expect(full["invoices.0.invoiceNumber"]).toBe("Required");
    expect(full["items.0.unitPrice"]).toBeUndefined();
    expect(full["items.0.itemName"]).toBeUndefined();
    expect(submitProblems(form, settingsFor(8))["items.0.unitPrice"]).toBe("Required");
  });
});
