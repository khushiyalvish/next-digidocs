"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { Plus, Save, Send, Trash2, X } from "lucide-react";
import { ActionForm, FormMessage, useFormState } from "@/components/forms/action-form";
import { LocalTime } from "@/components/local-time";
import { Button, buttonClasses } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Alert, Card, CardBody, controlHeight, inputClasses } from "@/components/ui/primitives";
import { amount, calculateItems, sameAmount, shipmentUnitsFor, sumFob, totalTonnes, totalTonnesIsCalculated } from "@/features/imports/calculation";
import { formatAmount, formatMoney } from "@/features/imports/format";
import { saveImport } from "@/features/imports/actions";
import { DocumentsSection, DutyPaidFile, useImportDocuments, type ImportDocuments } from "./documents-section";
import { blLineLabel, CONTAINER_SIZES, INVOICE_TYPES, LINE_FIELDS, MAX_BL_NUMBERS, SHIPPING_MODES, type BlNumbersSetting, type ItemLayout, type KeyField } from "@/features/imports/form";
import { ConfirmDialogButton } from "@/components/confirm-dialog";
import { SearchableSelect, type SelectOption } from "@/components/searchable-select";
import type { ImportFormDto } from "@/features/imports/queries";
import type { ImportFormOptions } from "@/features/reference/queries";

/*
 * The Add Import form (old ImpExp/AddImpExp), for an import whose Particular and tracking number
 * are fixed. Sections: Key Information (the fields the Particular shows), Bill of Lading numbers,
 * Invoice Details (Single: one invoice; Multiple: "Add more"), Container Details (Sea Container
 * Import only), Item Details (the short table for Local Import / Local Purchase, else the full
 * one). Save as draft keeps whatever is filled in; Submit asks first, and the server checks every
 * field (features/imports/form.ts). Item values are calculated live by features/imports/calculation.ts
 * from the invoice FOB total and the key information's Freight and Insurance; the server calculates
 * them again before storing (features/imports/rules.ts). As old: changing the invoice FOB total
 * clears the item FOBs; the item FOBs may not add up to more than it.
 */

type Hse = NonNullable<ImportFormDto["items"][number]["hse"]>;
type Invoice = ImportFormDto["invoices"][number];
type Container = ImportFormDto["containers"][number];
type Item = Omit<ImportFormDto["items"][number], "hse"> & { hse: Hse | null };
type Keyed<T> = T & { key: number };

const EMPTY_INVOICE: Invoice = { invoiceNumber: "", invoiceDate: "", fobValue: "", supplierName: "" };
const EMPTY_CONTAINER: Container = { containerNumber: "", containerSize: "", sealNumber: "" };
const EMPTY_ITEM: Item = { itemName: "", fobValue: "", quantity: "", unitId: "", unitPrice: "", hse: null };

const INVOICE_TYPE_OPTIONS = Object.entries(INVOICE_TYPES).map(([id, label]) => ({ id, label }));
const CONTAINER_SIZE_OPTIONS = Object.entries(CONTAINER_SIZES).map(([id, label]) => ({ id, label }));

const cellInput = cx(inputClasses, controlHeight, "min-w-28");
const readOnlyInput = cx(inputClasses, controlHeight, "min-w-24 bg-subtle text-muted");

// Calculated values show 2 decimals, FOB values up to 4 (features/imports/format.ts).
const money = formatMoney;
const fullAmount = formatAmount;

/** Rows with stable keys, so removing one never mixes up the inputs of the others. */
function useLines<T>(initial: T[], empty: T) {
  const [lines, setLines] = useState<Keyed<T>[]>(() => (initial.length > 0 ? initial : [empty]).map((line, key) => ({ ...line, key })));
  // New lines get keys after the first ones; read only in event handlers.
  const next = useRef(Math.max(initial.length, 1));
  return {
    lines,
    add: () => setLines((current) => [...current, { ...empty, key: next.current++ }]),
    remove: (key: number) => setLines((current) => current.filter((line) => line.key !== key)),
    update: (key: number, patch: Partial<T>) => setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line))),
    keepFirst: () => setLines((current) => current.slice(0, 1)),
    patchAll: (patch: Partial<T>) => setLines((current) => current.map((line) => ({ ...line, ...patch }))),
  };
}

type Lines<T> = ReturnType<typeof useLines<T>>;

/** The key-information values the calculations follow while the person types. */
const LIVE_KEYS = ["freightValue", "insuranceValue", "shipmentQuantity", "shipmentUnitId", "totalTonnes"] as const;
type LiveKey = (typeof LIVE_KEYS)[number];
type LiveValues = Record<LiveKey, string>;

const INVOICE_FOB_CHANGED =
  "Invoice FOB value has changed. Item FOB and all calculated item values have been reset to 0. Please re-enter the item FOB details.";
const ITEM_FOB_TOO_HIGH = "Item FOB total cannot exceed Invoice FOB.";

export function ImportForm({
  form,
  options,
  keyFields,
  blNumbers,
  itemLayout,
  showContainers,
  defaults,
  documents,
  dutyPaidFile,
}: {
  form: ImportFormDto;
  options: ImportFormOptions;
  keyFields: KeyField[];
  /** The Bill of Lading section of the Particular; null: it has none. */
  blNumbers: BlNumbersSetting | null;
  itemLayout: ItemLayout;
  showContainers: boolean;
  /** Values the old form chose for an empty field (shipping mode, currency). */
  defaults: Partial<Record<string, string>>;
  /** The Particular's documents with their files, and the Duty Paid File. */
  documents: ImportDocuments;
  /** The key information's Duty Paid File, if the Particular has it. */
  dutyPaidFile: { label: string; required: boolean } | null;
}) {
  const intentRef = useRef<HTMLInputElement>(null);
  const documentsState = useImportDocuments(form.id, documents);
  const invoices = useLines(form.invoices, EMPTY_INVOICE);
  const items = useLines(form.items, EMPTY_ITEM);
  const [live, setLive] = useState<LiveValues>(() => Object.fromEntries(LIVE_KEYS.map((key) => [key, form.keyInfo[key] ?? ""])) as LiveValues);
  const [itemNotice, setItemNotice] = useState<string | null>(null);
  const invoiceTotal = sumFob(invoices.lines.map((line) => amount(line.fobValue)));

  /**
   * Old resetItemCalculations: when the invoice FOB total changes while items have a FOB, every
   * item FOB (and so every calculated value) is cleared, with a message.
   */
  function invoicesWillBe(next: Invoice[]) {
    const nextTotal = sumFob(next.map((line) => amount(line.fobValue)));
    if (!sameAmount(nextTotal, invoiceTotal) && items.lines.some((line) => amount(line.fobValue) > 0)) {
      items.patchAll({ fobValue: "" });
      setItemNotice(INVOICE_FOB_CHANGED);
    }
  }
  const invoiceHandlers = {
    update: (key: number, patch: Partial<Invoice>) => {
      if ("fobValue" in patch) invoicesWillBe(invoices.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
      invoices.update(key, patch);
    },
    remove: (key: number) => {
      invoicesWillBe(invoices.lines.filter((line) => line.key !== key));
      invoices.remove(key);
    },
    keepFirst: () => {
      invoicesWillBe(invoices.lines.slice(0, 1));
      invoices.keepFirst();
    },
  };

  return (
    <ActionForm action={saveImport} hidden={{ importId: form.id }} className="space-y-6">
      <input ref={intentRef} type="hidden" name="intent" defaultValue="draft" />
      <ScrollToFirstError />
      <KeyInformation
        form={form}
        options={options}
        keyFields={keyFields}
        blNumbers={blNumbers}
        defaults={defaults}
        dutyPaidFile={dutyPaidFile && { ...dutyPaidFile, state: documentsState }}
        live={live}
        onLive={(patch) => setLive((current) => ({ ...current, ...patch }))}
      />
      {/* Old order: documents right after the key information. */}
      <DocumentsSection importId={form.id} state={documentsState} />
      <Invoices initialType={form.invoiceType} lines={invoices} handlers={invoiceHandlers} total={invoiceTotal} />
      {showContainers && <Containers initial={form.containers} />}
      <Items
        lines={items}
        layout={itemLayout}
        units={options.units}
        invoiceTotal={invoiceTotal}
        freight={amount(live.freightValue)}
        insurance={amount(live.insuranceValue)}
        notice={itemNotice}
        onNotice={setItemNotice}
      />
      <FormMessage />
      <FormButtons intentRef={intentRef} />
    </ActionForm>
  );
}

// ---- Shared pieces ------------------------------------------------------------------------------

function useErrors(): Record<string, string> {
  const { result } = useFormState();
  return result && !result.ok ? (result.fieldErrors ?? {}) : {};
}

/** After a refused save, bring the first field with a message into view. */
function ScrollToFirstError() {
  const { result } = useFormState();
  useEffect(() => {
    if (result && !result.ok) document.querySelector('[aria-invalid="true"], [data-field-error]')?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [result]);
  return null;
}

function Section({ title, count, error, children }: { title: string; count?: number; error?: string; children: ReactNode }) {
  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {count !== undefined && (
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary tabular-nums">{count}</span>
        )}
      </div>
      <CardBody className="space-y-4">
        {error && <p className="text-[0.8125rem] text-danger">{error}</p>}
        {children}
      </CardBody>
    </Card>
  );
}

function Field({ label, required, error, htmlFor, children }: { label: string; required?: boolean; error?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error && <p className="text-[0.8125rem] text-danger">{error}</p>}
    </div>
  );
}

function CellError({ error }: { error?: string }) {
  return error ? <p className="mt-1 text-xs text-danger">{error}</p> : null;
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} aria-label={label}>
      <Trash2 aria-hidden className="text-danger" /> <span className="hidden sm:inline">Remove</span>
    </Button>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant="secondary" size="sm" onClick={onClick}>
      <Plus aria-hidden /> {children}
    </Button>
  );
}

/** A wide table that scrolls inside its own box on small screens; the page never does. */
function LineTable({ head, children, foot }: { head: string[]; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {head.map((label) => (
              <th key={label} scope="col" className="border-b border-line bg-subtle px-2 py-2 text-left text-xs font-semibold whitespace-nowrap text-ink-soft first:pl-4 sm:first:pl-2">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
        {foot && <tfoot>{foot}</tfoot>}
      </table>
    </div>
  );
}

function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("border-b border-line-soft px-2 py-2 align-top first:pl-4 sm:first:pl-2", className)}>{children}</td>;
}

// ---- Key information ----------------------------------------------------------------------------

function KeyInformation({
  form,
  options,
  keyFields,
  blNumbers,
  defaults,
  dutyPaidFile,
  live,
  onLive,
}: {
  form: ImportFormDto;
  options: ImportFormOptions;
  keyFields: KeyField[];
  blNumbers: BlNumbersSetting | null;
  defaults: Partial<Record<string, string>>;
  dutyPaidFile: { label: string; required: boolean; state: ReturnType<typeof useImportDocuments> } | null;
  live: LiveValues;
  onLive: (patch: Partial<LiveValues>) => void;
}) {
  const errors = useErrors();
  const [dutyPaid, setDutyPaid] = useState(form.keyInfo.dutyPaid);
  const idPrefix = useId();
  const value = (key: string) => form.keyInfo[key] || defaults[key] || "";
  const legacyId = form.particular.legacyId;
  const shipmentUnits = shipmentUnitsFor(legacyId, options.units);
  const tonnesCalculated = totalTonnesIsCalculated(legacyId);

  /** Old updateTotalTonnes: Shipment Qty or its unit changed → Total Tonnes again (blank unless KGS or TONS). */
  function setShipment(patch: Partial<Pick<LiveValues, "shipmentQuantity" | "shipmentUnitId">>) {
    const quantity = patch.shipmentQuantity ?? live.shipmentQuantity;
    const unitId = patch.shipmentUnitId ?? live.shipmentUnitId;
    const unitLegacyId = options.units.find((unit) => unit.id === unitId)?.legacyId ?? null;
    const tonnes = totalTonnes(quantity.trim() ? amount(quantity) : null, unitLegacyId);
    onLive({ ...patch, totalTonnes: tonnes === null ? "" : String(tonnes) });
  }

  const selectOptions: Record<string, { id: string; label: string }[]> = {
    country: options.countries,
    state: options.states,
    agent: options.clearingAgents,
    currency: options.currencies,
    port: options.ports,
    unit: shipmentUnits,
    shippingMode: Object.entries(SHIPPING_MODES).map(([id, label]) => ({ id, label })),
  };

  return (
    <Section title="Key Information">
      <dl className="grid gap-3 rounded-field bg-subtle px-4 py-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">Particular</dt>
          <dd className="font-medium text-ink">{form.particular.name}</dd>
        </div>
        <div>
          <dt className="text-muted">Tracking No.</dt>
          <dd className="font-medium wrap-anywhere text-ink">{form.trackingNumber}</dd>
        </div>
        <div>
          <dt className="text-muted">Doc Date</dt>
          <dd className="font-medium text-ink">
            <LocalTime value={form.createdAt} />
          </dd>
        </div>
      </dl>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {keyFields.map((field) => {
          if (field.key === "dutyReferenceNumber" && dutyPaid !== "yes") return null;
          const id = `${idPrefix}-${field.key}`;
          const error = errors[field.key];
          const common = { id, name: field.key, "aria-invalid": error ? true : undefined } as const;

          if (field.kind === "yesNo") {
            return (
              <Field key={field.key} label={field.label} required={field.required} error={error}>
                <div className="flex gap-4 pt-1" role="radiogroup" aria-label={field.label}>
                  {(["yes", "no"] as const).map((choice) => (
                    <label key={choice} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                      <input
                        type="radio"
                        name={field.key}
                        value={choice}
                        checked={dutyPaid === choice}
                        onChange={() => setDutyPaid(choice)}
                        className="size-5 accent-primary sm:size-4"
                      />
                      {choice === "yes" ? "Yes" : "No"}
                    </label>
                  ))}
                </div>
              </Field>
            );
          }
          if (field.kind === "longText") {
            return (
              <div key={field.key} className="sm:col-span-2 lg:col-span-3">
                <Field label={field.label} required={field.required} error={error} htmlFor={id}>
                  <textarea {...common} rows={3} defaultValue={value(field.key)} className={cx(inputClasses, "py-2")} />
                </Field>
              </div>
            );
          }
          if (field.key === "shipmentUnitId") {
            return (
              <Field key={field.key} label={field.label} required={field.required} error={error} htmlFor={id}>
                <SearchableSelect
                  id={id}
                  name={field.key}
                  options={shipmentUnits}
                  value={live.shipmentUnitId}
                  onChange={(option) => setShipment({ shipmentUnitId: option?.id ?? "" })}
                  invalid={Boolean(error)}
                />
              </Field>
            );
          }
          if (field.kind in selectOptions) {
            return (
              <Field key={field.key} label={field.label} required={field.required} error={error} htmlFor={id}>
                <SearchableSelect id={id} name={field.key} options={selectOptions[field.kind]} defaultValue={value(field.key)} invalid={Boolean(error)} />
              </Field>
            );
          }
          const numeric = field.kind === "money" || field.kind === "quantity" || field.kind === "count";
          const isLive = (LIVE_KEYS as readonly string[]).includes(field.key);
          const readOnly = field.key === "totalTonnes" && tonnesCalculated;
          return (
            <Field key={field.key} label={field.label} required={field.required} error={error} htmlFor={id}>
              <input
                {...common}
                type="text"
                inputMode={field.kind === "count" ? "numeric" : numeric ? "decimal" : undefined}
                {...(isLive
                  ? {
                      value: live[field.key as LiveKey],
                      onChange: (event: ChangeEvent<HTMLInputElement>) =>
                        field.key === "shipmentQuantity" ? setShipment({ shipmentQuantity: event.target.value }) : onLive({ [field.key]: event.target.value }),
                    }
                  : { defaultValue: value(field.key) })}
                readOnly={readOnly}
                autoComplete="off"
                className={cx(inputClasses, controlHeight, readOnly && "bg-subtle text-muted")}
              />
              {readOnly && <p className="text-xs text-muted">Worked out from Shipment Qty (KGS ÷ 1000, or TONS).</p>}
            </Field>
          );
        })}
      </div>
      {/* Old toggleDutyFields: the Duty Paid File only when the duty was paid. */}
      {dutyPaidFile && dutyPaid === "yes" && (
        <DutyPaidFile importId={form.id} state={dutyPaidFile.state} label={dutyPaidFile.label} required={dutyPaidFile.required} error={errors.dutyPaidFile} />
      )}
      {blNumbers && <BlNumbers initial={form.blNumbers} setting={blNumbers} />}
    </Section>
  );
}

// ---- Bill of Lading numbers ---------------------------------------------------------------------

/** The Particular's Bill of Lading / Waybill / Purchase Order numbers: one, or up to 10 for Dry and Liquid Bulk. */
function BlNumbers({ initial, setting }: { initial: string[]; setting: BlNumbersSetting }) {
  const errors = useErrors();
  const { lines, add, remove, update } = useLines(initial.map((blNumber) => ({ blNumber })), { blNumber: "" });
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lines.map((line, index) => {
          const label = blLineLabel(setting.label, index + 1);
          // Old checkDuplicateBL: a number entered twice is flagged at once; Save also checks other imports.
          const repeated = line.blNumber.trim() !== "" && lines.slice(0, index).some((other) => other.blNumber.trim().toLowerCase() === line.blNumber.trim().toLowerCase());
          const error = errors[`blNumbers.${index}`] ?? (repeated ? "Already entered above" : undefined);
          return (
            <Field key={line.key} label={label} required={setting.required && index === 0} error={error}>
              <div className="flex gap-2">
                <input
                  name={LINE_FIELDS.blNumbers.blNumber}
                  value={line.blNumber}
                  onChange={(event) => update(line.key, { blNumber: event.target.value })}
                  placeholder="e.g. ABC123"
                  autoComplete="off"
                  aria-label={label}
                  aria-invalid={error ? true : undefined}
                  className={cx(inputClasses, controlHeight)}
                />
                {lines.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(line.key)} aria-label={`Remove ${label}`}>
                    <X aria-hidden />
                  </Button>
                )}
              </div>
            </Field>
          );
        })}
      </div>
      {setting.multiple && lines.length < MAX_BL_NUMBERS && <AddButton onClick={add}>Add another</AddButton>}
    </div>
  );
}

// ---- Invoices -----------------------------------------------------------------------------------

function Invoices({
  initialType,
  lines: { lines, add },
  handlers: { update, remove, keepFirst },
  total,
}: {
  initialType: "single" | "multiple";
  lines: Lines<Invoice>;
  /** Changes that may change the FOB total go through the form, which may then clear item FOBs. */
  handlers: { update: (key: number, patch: Partial<Invoice>) => void; remove: (key: number) => void; keepFirst: () => void };
  total: number;
}) {
  const errors = useErrors();
  const [invoiceType, setInvoiceType] = useState(initialType);
  const multiple = invoiceType === "multiple";
  const typeId = useId();

  return (
    <Section title="Invoice Details" count={lines.length} error={errors.invoices}>
      <div className="sm:w-60">
        <Field label="Invoice Type" required htmlFor={typeId}>
          <SearchableSelect
            id={typeId}
            name="invoiceType"
            options={INVOICE_TYPE_OPTIONS}
            value={invoiceType}
            clearable={false}
            onChange={(option) => {
              const next = (option?.id ?? "single") as "single" | "multiple";
              setInvoiceType(next);
              if (next === "single") keepFirst(); // a single invoice keeps the first line
            }}
          />
        </Field>
      </div>

      <LineTable
        head={["Invoice Number", "Invoice Date", "FOB Value", "Supplier's Name", ...(multiple ? ["Action"] : [])]}
        foot={
          <tr>
            <Td className="font-semibold text-ink">Total FOB Value</Td>
            <Td />
            <Td>
              <input readOnly tabIndex={-1} value={fullAmount(total)} aria-label="Total FOB value" className={readOnlyInput} />
            </Td>
            <Td />
            {multiple && <Td />}
          </tr>
        }
      >
        {lines.map((line, index) => {
          const error = (key: string) => errors[`invoices.${index}.${key}`];
          return (
            <tr key={line.key}>
              <Td>
                <input name={LINE_FIELDS.invoices.invoiceNumber} value={line.invoiceNumber} onChange={(e) => update(line.key, { invoiceNumber: e.target.value })} placeholder="Invoice number" aria-label={`Invoice ${index + 1} number`} aria-invalid={error("invoiceNumber") ? true : undefined} className={cellInput} />
                <CellError error={error("invoiceNumber")} />
              </Td>
              <Td>
                <input type="date" name={LINE_FIELDS.invoices.invoiceDate} value={line.invoiceDate} onChange={(e) => update(line.key, { invoiceDate: e.target.value })} aria-label={`Invoice ${index + 1} date`} aria-invalid={error("invoiceDate") ? true : undefined} className={cellInput} />
                <CellError error={error("invoiceDate")} />
              </Td>
              <Td>
                <input inputMode="decimal" name={LINE_FIELDS.invoices.fobValue} value={line.fobValue} onChange={(e) => update(line.key, { fobValue: e.target.value })} placeholder="FOB value" aria-label={`Invoice ${index + 1} FOB value`} aria-invalid={error("fobValue") ? true : undefined} className={cellInput} />
                <CellError error={error("fobValue")} />
              </Td>
              <Td>
                <input name={LINE_FIELDS.invoices.supplierName} value={line.supplierName} onChange={(e) => update(line.key, { supplierName: e.target.value })} placeholder="Supplier's name" aria-label={`Invoice ${index + 1} supplier`} aria-invalid={error("supplierName") ? true : undefined} className={cellInput} />
                <CellError error={error("supplierName")} />
              </Td>
              {multiple && <Td>{lines.length > 1 && <RemoveButton onClick={() => remove(line.key)} label={`Remove invoice ${index + 1}`} />}</Td>}
            </tr>
          );
        })}
      </LineTable>
      {/* Old checkInvoice: "Add more" only for Multiple. */}
      {multiple && <AddButton onClick={add}>Add more</AddButton>}
    </Section>
  );
}

// ---- Containers ---------------------------------------------------------------------------------

function Containers({ initial }: { initial: Container[] }) {
  const errors = useErrors();
  const { lines, add, remove, update } = useLines(initial, EMPTY_CONTAINER);
  return (
    <Section title="Container Details" count={lines.length} error={errors.containers}>
      <LineTable head={["Container No", "Container Size", "Seal No", "Remove"]}>
        {lines.map((line, index) => {
          const error = (key: string) => errors[`containers.${index}.${key}`];
          return (
            <tr key={line.key}>
              <Td>
                <input name={LINE_FIELDS.containers.containerNumber} value={line.containerNumber} onChange={(e) => update(line.key, { containerNumber: e.target.value })} placeholder="Container no." aria-label={`Container ${index + 1} number`} aria-invalid={error("containerNumber") ? true : undefined} className={cellInput} />
                <CellError error={error("containerNumber")} />
              </Td>
              <Td>
                <SearchableSelect
                  name={LINE_FIELDS.containers.containerSize}
                  options={CONTAINER_SIZE_OPTIONS}
                  value={line.containerSize}
                  onChange={(option) => update(line.key, { containerSize: option?.id ?? "" })}
                  placeholder="-- Select Container Size --"
                  label={`Container ${index + 1} size`}
                  invalid={Boolean(error("containerSize"))}
                  className="min-w-44"
                />
                <CellError error={error("containerSize")} />
              </Td>
              <Td>
                <input name={LINE_FIELDS.containers.sealNumber} value={line.sealNumber} onChange={(e) => update(line.key, { sealNumber: e.target.value })} placeholder="Seal no." aria-label={`Container ${index + 1} seal number`} aria-invalid={error("sealNumber") ? true : undefined} className={cellInput} />
                <CellError error={error("sealNumber")} />
              </Td>
              <Td>{lines.length > 1 && <RemoveButton onClick={() => remove(line.key)} label={`Remove container ${index + 1}`} />}</Td>
            </tr>
          );
        })}
      </LineTable>
      <AddButton onClick={add}>Add more</AddButton>
    </Section>
  );
}

// ---- Items --------------------------------------------------------------------------------------

const ITEM_HEADS: Record<ItemLayout, string[]> = {
  local: ["Item", "FOB", "Quantity", "UOM", "Unit Price", "HSE Code", "VAT %", "Remove"],
  full: [
    "Item",
    "FOB",
    "Allocated Freight",
    "Allocated Insurance",
    "CIF Value (Total$)",
    "CISS (1% of FOB)",
    "ETLS (0.5% of CIF)",
    "Quantity",
    "UOM",
    "Unit Price",
    "HSE Code",
    "Duty %",
    "LVY %",
    "EXC %",
    "VAT %",
    "Remove",
  ],
};

function Items({
  lines: { lines, add, remove, update },
  layout,
  units,
  invoiceTotal,
  freight,
  insurance,
  notice,
  onNotice,
}: {
  lines: Lines<Item>;
  layout: ItemLayout;
  units: ImportFormOptions["units"];
  /** The invoices' FOB total: what the item FOBs share freight and insurance by, and must add up to. */
  invoiceTotal: number;
  freight: number;
  insurance: number;
  /** A message about the item FOBs (cleared by an invoice change, or refused). */
  notice: string | null;
  onNotice: (notice: string | null) => void;
}) {
  const errors = useErrors();
  const full = layout === "full";
  // The same calculation the server stores (features/imports/calculation.ts).
  const calculation = calculateItems({
    layout,
    invoiceFob: invoiceTotal,
    freight,
    insurance,
    items: lines.map((line) => ({ fob: amount(line.fobValue), quantity: amount(line.quantity) })),
  });
  const totalsDiffer = lines.some((line) => line.fobValue.trim() !== "") && !sameAmount(calculation.totals.fob, invoiceTotal);
  const fobProblem = Boolean(totalsDiffer || errors.itemFobTotal);

  /** Old guard: the item FOBs may not add up to more than the invoice FOB total; the FOB just typed is cleared. */
  function setFob(key: number, fobValue: string) {
    const nextTotal = sumFob(lines.map((line) => amount(line.key === key ? fobValue : line.fobValue)));
    if (invoiceTotal > 0 && nextTotal > invoiceTotal + 0.0001) {
      update(key, { fobValue: "" });
      onNotice(ITEM_FOB_TOO_HIGH);
      return;
    }
    if (notice) onNotice(null);
    update(key, { fobValue });
  }

  const shown = (value: number | null, label: string) => (
    <input readOnly tabIndex={-1} value={money(value ?? 0)} aria-label={label} className={readOnlyInput} />
  );
  const rate = (value: number | undefined, label: string) => (
    <input readOnly tabIndex={-1} value={value === undefined ? "0" : String(value)} aria-label={label} className={cx(readOnlyInput, "min-w-16")} />
  );

  return (
    <Section title="Item Details" count={lines.length} error={errors.items}>
      {notice && <Alert tone="warning">{notice}</Alert>}
      <LineTable
        head={ITEM_HEADS[layout]}
        foot={
          <tr>
            <Td className="font-semibold text-ink">TOTAL</Td>
            <Td>
              <input
                readOnly
                tabIndex={-1}
                value={fullAmount(calculation.totals.fob)}
                aria-label="Total item FOB"
                aria-invalid={fobProblem ? true : undefined}
                className={cx(readOnlyInput, fobProblem && "border-danger text-danger")}
              />
            </Td>
            {full && (
              <>
                <Td>{shown(calculation.totals.freight, "Total allocated freight")}</Td>
                <Td>{shown(calculation.totals.insurance, "Total allocated insurance")}</Td>
              </>
            )}
            <Td className="border-b-0" />
          </tr>
        }
      >
        {lines.map((line, index) => {
          const error = (key: string) => errors[`items.${index}.${key}`];
          const values = calculation.items[index];
          const n = index + 1;
          return (
            <tr key={line.key}>
              <Td>
                <input name={LINE_FIELDS.items.itemName} value={line.itemName} onChange={(e) => update(line.key, { itemName: e.target.value })} placeholder="Enter item name" aria-label={`Item ${n} name`} aria-invalid={error("itemName") ? true : undefined} className={cx(cellInput, "min-w-40")} />
                <CellError error={error("itemName")} />
              </Td>
              <Td>
                <input inputMode="decimal" name={LINE_FIELDS.items.fobValue} value={line.fobValue} onChange={(e) => setFob(line.key, e.target.value)} placeholder="Enter FOB value" aria-label={`Item ${n} FOB`} aria-invalid={error("fobValue") ? true : undefined} className={cellInput} />
                <CellError error={error("fobValue")} />
              </Td>
              {full && (
                <>
                  <Td>{shown(values?.allocatedFreight ?? 0, `Item ${n} allocated freight`)}</Td>
                  <Td>{shown(values?.allocatedInsurance ?? 0, `Item ${n} allocated insurance`)}</Td>
                  <Td>{shown(values?.cif ?? 0, `Item ${n} CIF value`)}</Td>
                  <Td>{shown(values?.ciss ?? 0, `Item ${n} CISS`)}</Td>
                  <Td>{shown(values?.etls ?? 0, `Item ${n} ETLS`)}</Td>
                </>
              )}
              <Td>
                <input inputMode="decimal" name={LINE_FIELDS.items.quantity} value={line.quantity} onChange={(e) => update(line.key, { quantity: e.target.value })} placeholder="0" aria-label={`Item ${n} quantity`} aria-invalid={error("quantity") ? true : undefined} className={cellInput} />
                <CellError error={error("quantity")} />
              </Td>
              <Td>
                <SearchableSelect
                  name={LINE_FIELDS.items.unitId}
                  options={units}
                  value={line.unitId}
                  onChange={(option) => update(line.key, { unitId: option?.id ?? "" })}
                  placeholder="-- Select Unit --"
                  label={`Item ${n} unit`}
                  invalid={Boolean(error("unitId"))}
                  className="min-w-36"
                />
                <CellError error={error("unitId")} />
              </Td>
              <Td>
                {full ? (
                  shown(values?.unitPrice ?? 0, `Item ${n} unit price`)
                ) : (
                  <>
                    <input inputMode="decimal" name={LINE_FIELDS.items.unitPrice} value={line.unitPrice} onChange={(e) => update(line.key, { unitPrice: e.target.value })} placeholder="0" aria-label={`Item ${n} unit price`} aria-invalid={error("unitPrice") ? true : undefined} className={cellInput} />
                    <CellError error={error("unitPrice")} />
                  </>
                )}
              </Td>
              <Td>
                <SearchableSelect
                  name={LINE_FIELDS.items.hseCodeId}
                  load={loadHseCodes}
                  value={line.hse?.id ?? ""}
                  selected={line.hse ? hseOption(line.hse) : null}
                  onChange={(option) => update(line.key, { hse: option?.data ?? null })}
                  placeholder="-- Select HSE Code --"
                  label={`Item ${n} HSE code`}
                  invalid={Boolean(error("hseCodeId"))}
                  className="min-w-44"
                />
                <CellError error={error("hseCodeId")} />
              </Td>
              {full && (
                <>
                  <Td>{rate(line.hse?.duty, `Item ${n} duty %`)}</Td>
                  <Td>{rate(line.hse?.levy, `Item ${n} levy %`)}</Td>
                  <Td>{rate(line.hse?.excise, `Item ${n} excise %`)}</Td>
                </>
              )}
              <Td>{rate(line.hse?.vat, `Item ${n} VAT %`)}</Td>
              <Td>{lines.length > 1 && <RemoveButton onClick={() => remove(line.key)} label={`Remove item ${n}`} />}</Td>
            </tr>
          );
        })}
      </LineTable>
      <p className={cx("text-[0.8125rem]", fobProblem ? "text-danger" : "text-muted")} data-field-error={errors.itemFobTotal ? true : undefined}>
        {errors.itemFobTotal ??
          `Invoice FOB total ${fullAmount(invoiceTotal)} · item FOB total ${fullAmount(calculation.totals.fob)}${totalsDiffer ? ": they must be equal to submit" : ""}`}
      </p>
      <AddButton onClick={add}>Add more</AddButton>
    </Section>
  );
}

/** HSE codes for the item rows' picker, by digits or description (GET /api/hse-codes). Module-level: the picker re-asks when it changes. */
async function loadHseCodes(query: string, signal: AbortSignal): Promise<SelectOption<Hse>[]> {
  const response = await fetch(`/api/hse-codes?q=${encodeURIComponent(query)}`, { signal });
  if (!response.ok) return [];
  return ((await response.json()) as Hse[]).map(hseOption);
}

function hseOption(hse: Hse): SelectOption<Hse> {
  return { id: hse.id, label: hse.code, detail: hse.description, data: hse };
}

// ---- Buttons ------------------------------------------------------------------------------------

/** Cancel · Save as draft · Submit, each save asking first in a popup, with the old form's questions. */
function FormButtons({ intentRef }: { intentRef: RefObject<HTMLInputElement | null> }) {
  function setIntent(intent: "draft" | "submit") {
    if (intentRef.current) intentRef.current.value = intent;
  }

  return (
    <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-end">
      <Link href="/imports" className={buttonClasses("ghost")}>
        Cancel
      </Link>
      <ConfirmDialogButton
        tone="confirm"
        variant="secondary"
        title="Save Confirmation"
        message="Are you sure you want to save this import form as a draft?"
        confirmLabel="Save"
        onConfirm={() => setIntent("draft")}
      >
        <Save aria-hidden /> Save as draft
      </ConfirmDialogButton>
      <ConfirmDialogButton
        tone="confirm"
        title="Submission Confirmation"
        message="Are you sure you want to submit this import form to LFZ?"
        confirmLabel="Submit"
        onConfirm={() => setIntent("submit")}
      >
        <Send aria-hidden /> Submit import
      </ConfirmDialogButton>
    </div>
  );
}
