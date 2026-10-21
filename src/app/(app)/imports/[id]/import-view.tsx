import type { ReactNode } from "react";
import Link from "next/link";
import { Download, FileText, Pencil } from "lucide-react";
import { menuTrail } from "@/features/access/menu";
import { ROLES, type RoleKey } from "@/features/access/roles";
import { LocalTime } from "@/components/local-time";
import { buttonClasses } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { formatBytes, type UploadedFile } from "@/features/imports/documents";
import { formatAmount, formatMoney, formatRate } from "@/features/imports/format";
import { CONTAINER_SIZES, SHIPPING_MODES, type BlNumbersSetting, type ItemLayout, type KeyField } from "@/features/imports/form";
import type { ImportDocumentsDto, ImportStepDto, ImportViewDto } from "@/features/imports/queries";
import { DECISION_LABELS, LETTER_KINDS, type ReviewStep } from "@/features/workflow/review";
import { REJECTED_STATUSES, STATUS_LABELS, STATUS_TONES } from "@/features/workflow/statuses";
import { PageTitle } from "@/app/(app)/page-title";
import { ReviewPanel } from "./review-panel";

/*
 * The View page of an import (old ImpExp/ViewImpExp), for everyone who may see it: a summary, the
 * officer's action panel when their role has a step now, then the import as submitted — key
 * information (the Particular's fields and labels), documents and review letters, invoices,
 * containers, items with their stored calculations — and the timeline of who did what. Read-only;
 * the enterprise edits through Edit.
 */

const base = (id: string) => `/api/imports/${id}/documents`;

export function ImportView({
  view,
  documents,
  steps,
  reviewSteps,
  keyFields,
  blNumbers,
  itemLayout,
  showContainers,
  canEdit,
}: {
  view: ImportViewDto;
  documents: ImportDocumentsDto;
  steps: ImportStepDto[];
  reviewSteps: readonly ReviewStep[];
  keyFields: KeyField[];
  blNumbers: BlNumbersSetting | null;
  itemLayout: ItemLayout;
  showContainers: boolean;
  canEdit: boolean;
}) {
  const rejected = REJECTED_STATUSES.includes(view.status);
  const invoiceTotal = view.invoices.reduce((sum, line) => sum + (line.fobValue ?? 0), 0);
  const hasFiles =
    documents.slots.some((slot) => slot.files.length > 0) || documents.dutyFiles.length > 0 || documents.letters.some((letter) => letter.files.length > 0);

  return (
    <div className="space-y-6">
      <PageTitle
        trail={[...menuTrail("/imports"), { label: view.trackingNumber ?? "Import" }]}
        title={`Import ${view.trackingNumber ?? ""}`}
        description={`${view.particular.name} · ${view.enterprise.name}`}
        badge={<Badge tone={STATUS_TONES[view.status]}>{STATUS_LABELS[view.status]}</Badge>}
        actions={
          <>
            {hasFiles && (
              // A plain link: the browser downloads the combined PDF (old "Download Document").
              <a href={`/api/imports/${view.id}/combined-pdf`} className={buttonClasses("secondary")} download>
                <Download aria-hidden /> Download Document
              </a>
            )}
            {canEdit && (
              <Link href={`/imports/${view.id}/edit`} className={buttonClasses("secondary")}>
                <Pencil aria-hidden /> Edit
              </Link>
            )}
          </>
        }
      />

      {rejected && view.statusReason && (
        <Alert tone="error">
          <span className="font-medium">{STATUS_LABELS[view.status]}:</span> {view.statusReason}
        </Alert>
      )}

      <ReviewPanel importId={view.id} steps={reviewSteps} intro={`This import is “${STATUS_LABELS[view.status]}”. Choose what to do.`} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Key Information" />
            <CardBody>
              <DescriptionList
                items={[
                  ...keyFields.map((field) => ({ label: field.label, value: keyValue(field, view.keyInfo[field.key]) })),
                  ...(blNumbers ? [{ label: blNumbers.label.replace(/\s*No\.\s*1\b/, " No."), value: view.blNumbers.length > 0 ? view.blNumbers.join(", ") : empty }] : []),
                ]}
              />
            </CardBody>
          </Card>

          <DocumentsCard id={view.id} documents={documents} />

          <Card>
            <CardHeader title="Invoices" description={view.invoiceType === "multiple" ? "Multiple invoices" : "Single invoice"} />
            <ViewTable
              head={["Invoice No.", "Date", "Supplier", "FOB"]}
              numeric={[3]}
              rows={view.invoices.map((line) => [line.invoiceNumber || empty, line.invoiceDate ?? empty, line.supplierName || empty, formatAmount(line.fobValue)])}
              foot={["Total FOB", "", "", formatAmount(invoiceTotal)]}
            />
          </Card>

          {showContainers && (
            <Card>
              <CardHeader title="Containers" />
              <ViewTable
                head={["Container No.", "Size", "Seal No."]}
                rows={view.containers.map((line) => [
                  line.containerNumber || empty,
                  line.containerSize ? CONTAINER_SIZES[line.containerSize as keyof typeof CONTAINER_SIZES] ?? line.containerSize : empty,
                  line.sealNumber || empty,
                ])}
              />
            </Card>
          )}
        </div>

        <aside className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Summary" />
            <CardBody>
              <dl className="space-y-3 text-sm">
                <Fact label="Tracking No.">{view.trackingNumber ?? empty}</Fact>
                <Fact label="Particular">{view.particular.name}</Fact>
                <Fact label="Enterprise">
                  {view.enterprise.name} <span className="text-muted">({view.enterprise.code})</span>
                </Fact>
                <Fact label="Doc date">
                  <LocalTime value={view.createdAt} />
                </Fact>
                <Fact label="Submitted">{view.submittedAt ? <LocalTime value={view.submittedAt} /> : empty}</Fact>
                <Fact label="Status">
                  <Badge tone={STATUS_TONES[view.status]}>{STATUS_LABELS[view.status]}</Badge>
                </Fact>
              </dl>
            </CardBody>
          </Card>
          <Timeline id={view.id} steps={steps} documents={documents} />
        </aside>
      </div>

      {/* Full width: the item table has many columns. */}
      <ItemsCard view={view} layout={itemLayout} />

      {/* Again at the bottom, where the old page had its buttons: after reading the whole import. */}
      <ReviewPanel importId={view.id} steps={reviewSteps} intro="You have read the import. Choose what to do." />
    </div>
  );
}

const empty = <span className="text-faint">—</span>;

function keyValue(field: KeyField, value: string | undefined): ReactNode {
  if (!value) return empty;
  if (field.key === "shippingMode") return SHIPPING_MODES[value as keyof typeof SHIPPING_MODES] ?? value;
  if (field.kind === "money") return formatAmount(Number(value));
  return value;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 wrap-anywhere text-ink">{children}</dd>
    </div>
  );
}

function FileLink({ id, file }: { id: string; file: UploadedFile }) {
  return (
    <a href={`${base(id)}/${file.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-2 hover:underline">
      <FileText className="size-4 shrink-0" aria-hidden />
      <span className="wrap-anywhere">{file.name}</span>
      <span className="text-xs font-normal text-muted">({formatBytes(file.sizeBytes)})</span>
    </a>
  );
}

function DocumentsCard({ id, documents }: { id: string; documents: ImportDocumentsDto }) {
  const rows = [
    ...documents.slots.map((slot) => ({ key: slot.documentTypeId, name: slot.name, required: slot.required, files: slot.files })),
    ...(documents.dutyFiles.length > 0 ? [{ key: "duty", name: "Duty Paid File", required: false, files: documents.dutyFiles }] : []),
  ];
  const letters = documents.letters.filter((letter) => letter.files.length > 0);
  if (rows.length === 0 && letters.length === 0) return null;
  return (
    <Card>
      <CardHeader title="Documents" />
      <ul className="divide-y divide-line-soft">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
            <span className="text-sm text-ink-soft sm:w-64 sm:shrink-0">{row.name}</span>
            <span className="flex min-w-0 flex-col gap-1 text-sm">
              {row.files.length > 0 ? row.files.map((file) => <FileLink key={file.id} id={id} file={file} />) : <span className="text-faint">Not uploaded</span>}
            </span>
          </li>
        ))}
        {letters.map((letter) => (
          <li key={letter.kind} className="flex flex-col gap-1 bg-subtle/60 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
            <span className="text-sm font-medium text-ink sm:w-64 sm:shrink-0">{LETTER_KINDS[letter.kind]}</span>
            <span className="flex min-w-0 flex-col gap-1 text-sm">
              {letter.files.map((file, index) => (
                <span key={file.id} className="flex flex-wrap items-center gap-2">
                  <FileLink id={id} file={file} />
                  {index < letter.files.length - 1 && <span className="text-xs text-muted">(earlier)</span>}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** A small read-only table that scrolls inside its own box on narrow screens. */
function ViewTable({ head, rows, foot, numeric = [] }: { head: string[]; rows: ReactNode[][]; foot?: ReactNode[]; numeric?: number[] }) {
  const align = (index: number) => (numeric.includes(index) ? "text-right tabular-nums" : "text-left");
  if (rows.length === 0) return <CardBody className="text-sm text-faint">None</CardBody>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-line bg-subtle">
            {head.map((label, index) => (
              <th key={label} scope="col" className={cx("px-4 py-2 text-xs font-semibold whitespace-nowrap text-ink-soft sm:px-5", align(index))}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {rows.map((cells, rowIndex) => (
            <tr key={rowIndex}>
              {cells.map((cell, index) => (
                <td key={index} className={cx("px-4 py-2.5 align-top text-ink sm:px-5", align(index))}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr className="border-t border-line bg-subtle font-semibold">
              {foot.map((cell, index) => (
                <td key={index} className={cx("px-4 py-2 text-ink sm:px-5", align(index))}>
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function ItemsCard({ view, layout }: { view: ImportViewDto; layout: ItemLayout }) {
  const full = layout === "full";
  const sum = (pick: (item: ImportViewDto["items"][number]) => number | null) => view.items.reduce((total, item) => total + (pick(item) ?? 0), 0);
  const item = (line: ImportViewDto["items"][number]) => (
    <>
      <span className="block font-medium">{line.itemName || "—"}</span>
      {line.hseCode && (
        <span className="block text-xs text-muted" title={line.hseDescription ?? undefined}>
          HSE {line.hseCode}
        </span>
      )}
    </>
  );
  const quantity = (line: ImportViewDto["items"][number]) => (line.quantity === null ? "—" : `${Number(line.quantity).toLocaleString()} ${line.unit ?? ""}`.trim());

  return (
    <Card>
      <CardHeader title="Items" />
      {full ? (
        <ViewTable
          head={["Item", "Quantity", "FOB", "Freight", "Insurance", "CIF", "CISS", "ETLS", "Unit price", "Duty", "LVY", "EXC", "VAT"]}
          numeric={[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
          rows={view.items.map((line) => [
            item(line),
            quantity(line),
            formatAmount(line.fobValue),
            formatMoney(line.allocatedFreight),
            formatMoney(line.allocatedInsurance),
            formatMoney(line.cif),
            formatMoney(line.ciss),
            formatMoney(line.etls),
            formatMoney(line.unitPrice),
            formatRate(line.dutyRate),
            formatRate(line.levyRate),
            formatRate(line.exciseRate),
            formatRate(line.vatRate),
          ])}
          foot={[
            "Total",
            "",
            formatAmount(sum((line) => line.fobValue)),
            formatMoney(sum((line) => line.allocatedFreight)),
            formatMoney(sum((line) => line.allocatedInsurance)),
            formatMoney(sum((line) => line.cif)),
            formatMoney(sum((line) => line.ciss)),
            formatMoney(sum((line) => line.etls)),
            "",
            "",
            "",
            "",
            "",
          ]}
        />
      ) : (
        <ViewTable
          head={["Item", "Quantity", "FOB", "Unit price", "VAT"]}
          numeric={[2, 3, 4]}
          rows={view.items.map((line) => [item(line), quantity(line), formatAmount(line.fobValue), formatMoney(line.unitPrice), formatRate(line.vatRate)])}
          foot={["Total", "", formatAmount(sum((line) => line.fobValue)), "", ""]}
        />
      )}
    </Card>
  );
}

/** Who did what, oldest first, with the reason of a rejection and the letter of an approval. */
function Timeline({ id, steps, documents }: { id: string; steps: ImportStepDto[]; documents: ImportDocumentsDto }) {
  const letters = new Map(documents.letters.flatMap((letter) => letter.files.map((file) => [file.id, file] as const)));
  return (
    <Card>
      <CardHeader title="Timeline" />
      <CardBody>
        {steps.length === 0 ? (
          <p className="text-sm text-faint">No steps recorded yet.</p>
        ) : (
          <ol className="relative space-y-5 border-l border-line pl-5">
            {steps.map((step) => {
              const letter = step.letterDocumentId ? letters.get(step.letterDocumentId) : undefined;
              const tone = STATUS_TONES[step.status];
              return (
                <li key={step.id} className="relative">
                  <span
                    aria-hidden
                    className={cx(
                      "absolute top-1 -left-[1.6rem] size-3 rounded-full ring-4 ring-surface",
                      tone === "danger" ? "bg-danger" : tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-line-strong",
                    )}
                  />
                  <p className="text-sm font-medium text-ink">
                    {DECISION_LABELS[step.decision as keyof typeof DECISION_LABELS] ?? step.decision}
                    <span className="font-normal text-muted"> → {STATUS_LABELS[step.status]}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {step.actorName} · {ROLES[step.actorRole as RoleKey]?.label ?? step.actorRole} · <LocalTime value={step.at} />
                  </p>
                  {step.reason && <p className="mt-1 rounded-field bg-danger-soft px-2 py-1 text-[0.8125rem] wrap-anywhere text-danger">{step.reason}</p>}
                  {letter && (
                    <p className="mt-1 text-[0.8125rem]">
                      <FileLink id={id} file={letter} />
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
