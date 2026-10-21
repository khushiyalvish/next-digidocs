import { z } from "zod";
import { idSchema } from "@/lib/schemas";

/*
 * The Add Import form (module 4; old ImpExp/AddImpExp): which sections and fields a Particular
 * shows, how the posted form is read, and what Submit requires (decision log 2026-10-14).
 *
 *   Save as draft  stores whatever is filled in, even nothing; only malformed values are refused.
 *   Submit         also requires every field the form shows, and at least one line where a
 *                  section needs one, each with a message on the field.
 *
 * Particulars are told apart by their old id (transaction_types.legacy_id): 3 Sea Container Import
 * has containers; 8 Local Import and 9 Local Purchase have the short item table.
 *
 * Which key-information fields a Particular shows, its label for each and which Submit requires
 * are settings in the database (migration 0010, copied from old Map_KeyInputParticular); the
 * caller reads them (listTransactionTypeKeyFields) and passes them in as ImportFormSettings. This
 * file knows each field's kind and the order the old form showed them in. A field the Particular
 * does not show is not saved; "BL No" (blNumbers) is the Bill of Lading section's setting.
 *
 * Pure: no database, no session.
 */

// ---- What a Particular shows ------------------------------------------------------------------

export const SHIPPING_MODES = { sea: "Sea", road: "Road", air: "Air" } as const;
export type ShippingMode = keyof typeof SHIPPING_MODES;

export const CONTAINER_SIZES = { "20": "20", "40": "40", other: "Other" } as const;
export type ContainerSize = keyof typeof CONTAINER_SIZES;

export const INVOICE_TYPES = { single: "Single", multiple: "Multiple" } as const;
export type InvoiceType = keyof typeof INVOICE_TYPES;

/**
 * The key-information fields the form can show, in the old form's order (its
 * _ImportKeyInfoInputsPartial), each with its key_info_fields.field_key and old id. Not here:
 * 24 Supplier Name (no Particular shows it; suppliers are on the invoices), 30 BL No (its own
 * section), 46 Duty Paid File (comes with the documents).
 */
export const KEY_FIELDS = [
  { key: "importCountryId", oldId: 28, kind: "country" },
  { key: "importStateId", oldId: 29, kind: "state" },
  { key: "clearingAgentId", oldId: 35, kind: "agent" },
  { key: "shippingMode", oldId: 25, kind: "shippingMode" },
  { key: "dischargePortId", oldId: 42, kind: "port" },
  { key: "consignmentCurrencyId", oldId: 31, kind: "currency" },
  { key: "packingListNumber", oldId: 27, kind: "text" },
  { key: "freightValue", oldId: 37, kind: "money" },
  { key: "insuranceValue", oldId: 38, kind: "money" },
  { key: "shipmentQuantity", oldId: 32, kind: "quantity" },
  { key: "airQuantity", oldId: 33, kind: "quantity" },
  { key: "shipmentUnitId", oldId: 43, kind: "unit" },
  { key: "totalCbm", oldId: 44, kind: "quantity" },
  { key: "totalTonnes", oldId: 45, kind: "quantity" },
  { key: "dutyPaid", oldId: 40, kind: "yesNo" },
  { key: "dutyReferenceNumber", oldId: 41, kind: "text" },
  { key: "materialDescription", oldId: 39, kind: "longText" },
  { key: "consignmentValue", oldId: 36, kind: "money" },
  { key: "invoiceNumber", oldId: 26, kind: "text" },
  { key: "containerCount", oldId: 34, kind: "count" },
] as const;

export type KeyFieldKey = (typeof KEY_FIELDS)[number]["key"];
export type KeyField = (typeof KEY_FIELDS)[number] & { label: string; required: boolean };

/** One field's setting for a Particular (transaction_type_key_fields): its label there, and whether Submit requires it. */
export interface KeyFieldSetting {
  fieldKey: string;
  label: string;
  required: boolean;
}

/** What decides an import's form: its Particular's old id and that Particular's field settings. */
export interface ImportFormSettings {
  legacyId: number | null;
  keyFields: readonly KeyFieldSetting[];
}

/** The key-information fields a Particular shows, in the old form's order, with its labels. */
export function keyFieldsFor(settings: ImportFormSettings): KeyField[] {
  return KEY_FIELDS.flatMap((field) => {
    const setting = settings.keyFields.find((each) => each.fieldKey === field.key);
    return setting ? [{ ...field, label: setting.label, required: setting.required }] : [];
  });
}

/** At most this many Bill of Lading numbers (old addNewBL). */
export const MAX_BL_NUMBERS = 10;

export interface BlNumbersSetting {
  label: string;
  required: boolean;
  /** Dry Bulk and Liquid Bulk Import (old ids 1, 2) may add more, up to MAX_BL_NUMBERS; the others have one (old toggleBLLabel). */
  multiple: boolean;
}

/** The Bill of Lading section ("Air Waybill No.", "Purchase Order"…) of a Particular; null: not shown. */
export function blNumbersFor(settings: ImportFormSettings): BlNumbersSetting | null {
  const setting = settings.keyFields.find((each) => each.fieldKey === "blNumbers");
  if (!setting) return null;
  return { label: setting.label, required: setting.required, multiple: settings.legacyId === 1 || settings.legacyId === 2 };
}

/** A line's label: "Bill of Lading No. 1(Bill No.)" numbered for the line (old updateBLLabels). */
export function blLineLabel(label: string, line: number): string {
  const numbered = /No\.\s*1\b/;
  if (numbered.test(label)) return label.replace(numbered, `No. ${line}`);
  return line === 1 ? label : `${label} ${line}`;
}

/** The item table: the short one (Local Import, Local Purchase) or the full one with duties. */
export type ItemLayout = "local" | "full";

export function itemLayoutFor(particularLegacyId: number | null): ItemLayout {
  return particularLegacyId === 8 || particularLegacyId === 9 ? "local" : "full";
}

/** Only Sea Container Import has the Container section. */
export function hasContainers(particularLegacyId: number | null): boolean {
  return particularLegacyId === 3;
}

/** What the old form chose for a new import (its setShippingMode): Air Shipment by air, Local Import/Purchase by road, Sea Container by sea. */
export function defaultShippingMode(particularLegacyId: number | null): ShippingMode | null {
  if (particularLegacyId === 17) return "air";
  if (particularLegacyId === 8 || particularLegacyId === 9) return "road";
  if (particularLegacyId === 3) return "sea";
  return null;
}

// ---- Reading the posted form ------------------------------------------------------------------

/** "" or not posted → null, so an untouched field is simply not filled in. */
const blank = (value: unknown) => (value === undefined || (typeof value === "string" && value.trim() === "") ? null : value);

const text = (max: number) => z.preprocess(blank, z.string().trim().max(max, `At most ${max} characters`).nullable());
const optionalId = z.preprocess(blank, idSchema.nullable());
const decimal = (scale: number) =>
  z.preprocess(
    (value) => blank(typeof value === "string" ? value.replace(/,/g, "") : value),
    z.coerce
      .number({ message: "Enter a number" })
      .min(0, "Cannot be negative")
      .max(1e15, "Too large")
      .refine((value) => Number.isFinite(value) && Math.abs(value * 10 ** scale - Math.round(value * 10 ** scale)) < 1e-6, `At most ${scale} decimals`)
      .nullable(),
  );
const count = z.preprocess(blank, z.coerce.number({ message: "Enter a whole number" }).int("Enter a whole number").min(0).max(10_000).nullable());
const isoDate = z.preprocess(blank, z.iso.date({ message: "Enter a date" }).nullable());
const yesNo = z.preprocess((value) => (value === "yes" ? true : value === "no" ? false : null), z.boolean().nullable());
const choice = <T extends string>(values: readonly [T, ...T[]]) => z.preprocess(blank, z.enum(values).nullable());

const keyInfoSchema = z.object({
  importCountryId: optionalId,
  importStateId: optionalId,
  clearingAgentId: optionalId,
  shippingMode: choice(Object.keys(SHIPPING_MODES) as [ShippingMode, ...ShippingMode[]]),
  dischargePortId: optionalId,
  consignmentCurrencyId: optionalId,
  packingListNumber: text(50),
  freightValue: decimal(2),
  insuranceValue: decimal(2),
  shipmentQuantity: decimal(3),
  airQuantity: decimal(3),
  shipmentUnitId: optionalId,
  totalCbm: decimal(2),
  totalTonnes: decimal(2),
  dutyPaid: yesNo,
  dutyReferenceNumber: text(200),
  materialDescription: text(4000),
  consignmentValue: decimal(2),
  invoiceNumber: text(50),
  containerCount: count,
});

const invoiceSchema = z.object({ invoiceNumber: text(500), invoiceDate: isoDate, fobValue: decimal(4), supplierName: text(500) });
const containerSchema = z.object({
  containerNumber: text(100),
  containerSize: choice(Object.keys(CONTAINER_SIZES) as [ContainerSize, ...ContainerSize[]]),
  sealNumber: text(200),
});
const itemSchema = z.object({
  itemName: text(300),
  fobValue: decimal(4),
  quantity: decimal(3),
  unitId: optionalId,
  unitPrice: decimal(4),
  hseCodeId: optionalId,
});

const MAX_LINES = 500;

export const importFormSchema = keyInfoSchema.extend({
  importId: idSchema,
  intent: z.enum(["draft", "submit"]),
  invoiceType: z.enum(["single", "multiple"]).catch("single"),
  blNumbers: z.array(text(100)).max(MAX_BL_NUMBERS, `At most ${MAX_BL_NUMBERS} numbers`),
  invoices: z.array(invoiceSchema).max(MAX_LINES),
  containers: z.array(containerSchema).max(MAX_LINES),
  items: z.array(itemSchema).max(MAX_LINES),
});

export type ImportFormData = z.infer<typeof importFormSchema>;
export type InvoiceLine = z.infer<typeof invoiceSchema>;
export type ContainerLine = z.infer<typeof containerSchema>;
export type ItemLine = z.infer<typeof itemSchema>;

/** Field names of each line, as the form posts them (one value per line, in order). */
export const LINE_FIELDS = {
  blNumbers: { blNumber: "blNumber" },
  invoices: { invoiceNumber: "invoiceNo", invoiceDate: "invoiceDate", fobValue: "invoiceFob", supplierName: "invoiceSupplier" },
  containers: { containerNumber: "containerNumber", containerSize: "containerSize", sealNumber: "sealNumber" },
  items: { itemName: "itemName", fobValue: "itemFob", quantity: "itemQuantity", unitId: "itemUnit", unitPrice: "itemUnitPrice", hseCodeId: "itemHse" },
} as const;

const asList = (value: string | string[] | undefined): string[] => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

/** Lines posted as parallel lists (itemName[], itemFob[] …) back into one object per line. */
function zipLines<K extends string>(raw: Record<string, string | string[]>, fields: Record<K, string>): Record<K, string>[] {
  const columns = Object.entries(fields).map(([key, name]) => [key, asList(raw[name as string])] as const);
  const length = Math.max(0, ...columns.map(([, values]) => values.length));
  return Array.from({ length }, (_, index) => Object.fromEntries(columns.map(([key, values]) => [key, values[index] ?? ""])) as Record<K, string>);
}

/** The posted form (formToObject) in the shape importFormSchema reads. */
export function shapeImportForm(raw: Record<string, string | string[]>): Record<string, unknown> {
  const single = (name: string) => {
    const value = raw[name];
    return Array.isArray(value) ? value[0] : value;
  };
  return {
    ...Object.fromEntries(KEY_FIELDS.map((field) => [field.key, single(field.key)])),
    importId: single("importId"),
    intent: single("intent"),
    invoiceType: single("invoiceType"),
    blNumbers: asList(raw[LINE_FIELDS.blNumbers.blNumber]),
    invoices: zipLines(raw, LINE_FIELDS.invoices),
    containers: zipLines(raw, LINE_FIELDS.containers),
    items: zipLines(raw, LINE_FIELDS.items),
  };
}

/**
 * Keeps only what the Particular shows: key fields it does not show are emptied, BL numbers only
 * if it has the section (one unless it may have more), one invoice when the type is Single, containers only for Sea Container.
 */
export function normaliseForParticular(form: ImportFormData, settings: ImportFormSettings): ImportFormData {
  const bl = blNumbersFor(settings);
  const shown = new Set<string>(keyFieldsFor(settings).map((field) => field.key));
  const hidden = Object.fromEntries(KEY_FIELDS.filter((field) => !shown.has(field.key)).map((field) => [field.key, null]));
  return {
    ...form,
    ...hidden,
    blNumbers: bl ? (bl.multiple ? form.blNumbers : form.blNumbers.slice(0, 1)) : [],
    invoices: form.invoiceType === "single" ? form.invoices.slice(0, 1) : form.invoices,
    containers: hasContainers(settings.legacyId) ? form.containers : [],
  };
}

// ---- What Submit requires ---------------------------------------------------------------------

const REQUIRED = "Required";

/** Field errors that block Submit (empty: it may be submitted). Keys are the form's field paths. */
export function submitProblems(form: ImportFormData, settings: ImportFormSettings): Record<string, string> {
  const problems: Record<string, string> = {};
  const missing = (value: unknown) => value === null || value === undefined || value === "";
  const particularLegacyId = settings.legacyId;

  for (const field of keyFieldsFor(settings)) {
    if (!field.required) continue;
    // The duty reference only matters when the duty was paid (old toggleDutyFields).
    if (field.key === "dutyReferenceNumber" && form.dutyPaid !== true) continue;
    if (missing(form[field.key])) problems[field.key] = `${field.label} is required`;
  }

  const bl = blNumbersFor(settings);
  if (bl?.required && form.blNumbers.filter((value) => !missing(value)).length === 0) problems["blNumbers.0"] = `${bl.label} is required`;
  if (bl) {
    form.blNumbers.forEach((value, index) => {
      if (missing(value) && form.blNumbers.length > 1) problems[`blNumbers.${index}`] = "Fill in or remove this line";
    });
  }

  if (form.invoices.length === 0) problems.invoices = "Add an invoice";
  form.invoices.forEach((line, index) => {
    for (const key of ["invoiceNumber", "invoiceDate", "fobValue", "supplierName"] as const) {
      if (missing(line[key])) problems[`invoices.${index}.${key}`] = REQUIRED;
    }
  });

  if (hasContainers(particularLegacyId)) {
    if (form.containers.length === 0) problems.containers = "Add a container";
    form.containers.forEach((line, index) => {
      for (const key of ["containerNumber", "containerSize", "sealNumber"] as const) {
        if (missing(line[key])) problems[`containers.${index}.${key}`] = REQUIRED;
      }
    });
  }

  if (form.items.length === 0) problems.items = "Add an item";
  const itemKeys = itemLayoutFor(particularLegacyId) === "local"
    ? (["itemName", "fobValue", "quantity", "unitId", "unitPrice", "hseCodeId"] as const)
    : (["itemName", "fobValue", "quantity", "unitId", "hseCodeId"] as const);
  form.items.forEach((line, index) => {
    for (const key of itemKeys) {
      if (missing(line[key])) problems[`items.${index}.${key}`] = REQUIRED;
    }
  });

  return problems;
}
