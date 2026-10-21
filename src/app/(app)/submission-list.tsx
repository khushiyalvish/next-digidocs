import Link from "next/link";
import { Eye, Pencil, Plus, Search, Trash2, X, type LucideIcon } from "lucide-react";
import type { ActionResult } from "@/lib/result";
import type { Member } from "@/features/auth/guards";
import { dashboardCard } from "@/features/dashboard/steps";
import { rowActions } from "@/features/workflow/actions";
import { LIST_PAGE_SIZE, type ListFilter, type ListPage } from "@/features/workflow/list";
import { STATUS_LABELS, STATUS_TONES, VISIBLE_STATUSES } from "@/features/workflow/statuses";
import type { OptionDto } from "@/features/reference/queries";
import { ActionForm, FormMessage } from "@/components/forms/action-form";
import { ConfirmDialogButton } from "@/components/confirm-dialog";
import { LocalTime } from "@/components/local-time";
import { buttonClasses } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Badge, controlHeight, EmptyState, inputClasses } from "@/components/ui/primitives";
import { Cell, showFrom, Table } from "@/components/ui/table";
import { listHref, Pager } from "@/app/(app)/pager";
import { menuTrail } from "@/features/access/menu";
import { PageTitle } from "@/app/(app)/page-title";

/*
 * The import list and the export list (old ImpExp/ListImpExp and Export/ListExport): filters in
 * the address bar, one row per submission with its workflow status, newest first. Each row offers
 * View, Edit and Delete as the old lists did, by role and status (features/workflow/actions.ts);
 * Delete hides the record (decision log 2026-10-14).
 */

export interface SubmissionListProps {
  kind: "import" | "export";
  path: "/imports" | "/exports";
  member: Member;
  filter: ListFilter;
  result: ListPage;
  transactionTypes: OptionDto[];
  /** Only for roles that work across enterprises. */
  enterprises: OptionDto[];
  icon: LucideIcon;
  /** Delete on a row (hides it); the action re-checks role, organisation and status. */
  deleteAction: (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}

export function SubmissionList({ kind, path, member, filter, result, transactionTypes, enterprises, icon, deleteAction }: SubmissionListProps) {
  const noun = kind === "import" ? "import" : "export";
  const Noun = kind === "import" ? "Import" : "Export";
  const isEnterprise = member.role === "enterprise";
  // The old export list had no "Form Modified Date".
  const showFormSaved = kind === "import";
  const step = filter.step ? dashboardCard(filter.step) : undefined;
  const filters = { q: filter.q, status: filter.status, type: filter.type, enterprise: isEnterprise ? undefined : filter.enterprise, step: filter.step };
  const filtered = Object.values(filters).some(Boolean);
  const pageCount = Math.max(1, Math.ceil(result.total / LIST_PAGE_SIZE));

  return (
    <div>
      <PageTitle
        trail={menuTrail(path)}
        title={`${Noun} List`}
        description={isEnterprise ? `Your organisation's ${noun}s and where each one is in the workflow.` : `Submitted ${noun}s and where each one is in the workflow.`}
        actions={
          isEnterprise && (
            <Link href={`${path}/new`} className={buttonClasses("primary")}>
              <Plus aria-hidden /> Add {Noun}
            </Link>
          )
        }
      />

      {/* A plain GET form: the filters live in the address bar. */}
      <form method="get" action={path} className="mb-4 flex flex-wrap gap-2">
        {filter.step && <input type="hidden" name="step" value={filter.step} />}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            name="q"
            type="search"
            defaultValue={filter.q}
            placeholder={isEnterprise ? "Search tracking number" : "Search tracking number or enterprise"}
            aria-label={isEnterprise ? "Search tracking number" : "Search tracking number or enterprise"}
            className={cx(inputClasses, controlHeight, "pl-9")}
          />
        </div>
        <select name="status" defaultValue={filter.status ?? ""} aria-label="Status" className={cx(inputClasses, controlHeight, "w-full pr-8 sm:w-auto")}>
          <option value="">All statuses</option>
          {VISIBLE_STATUSES[member.role].map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={filter.type ?? ""} aria-label="Particular" className={cx(inputClasses, controlHeight, "w-full pr-8 sm:w-auto sm:max-w-64")}>
          <option value="">All particulars</option>
          {transactionTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
        {!isEnterprise && (
          <select
            name="enterprise"
            defaultValue={filter.enterprise ?? ""}
            aria-label="Enterprise"
            className={cx(inputClasses, controlHeight, "w-full pr-8 sm:w-auto sm:max-w-72")}
          >
            <option value="">All enterprises</option>
            {enterprises.map((enterprise) => (
              <option key={enterprise.id} value={enterprise.id}>
                {enterprise.label}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className={buttonClasses("secondary")}>
          Filter
        </button>
        {filtered && (
          <Link href={path} className={buttonClasses("ghost")}>
            Clear
          </Link>
        )}
      </form>

      {step && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <span>
            Dashboard step: <span className="font-medium text-ink">{step.label}</span> ({step.hint.toLowerCase()})
          </span>
          <Link href={listHref(path, { ...filters, step: undefined }, 1)} className={buttonClasses("ghost", "sm")}>
            <X aria-hidden /> Show every step
          </Link>
        </p>
      )}

      {result.rows.length === 0 ? (
        <EmptyState
          icon={icon}
          title={filtered ? `No ${noun}s match` : `No ${noun}s yet`}
          description={
            filtered
              ? "Try a different search or filter."
              : isEnterprise
                ? `${noun === "import" ? "Imports" : "Exports"} your organisation adds appear here.`
                : `${noun === "import" ? "Imports" : "Exports"} appear here once an enterprise submits them.`
          }
        />
      ) : (
        <>
          <Table
            columns={[
              { label: "Tracking No" },
              ...(isEnterprise ? [] : [{ label: "Enterprise", className: showFrom.md }]),
              { label: "Particular", className: showFrom.lg },
              { label: "Created", className: showFrom.lg },
              ...(showFormSaved ? [{ label: "Form Modified", className: showFrom.xl }] : []),
              { label: "Final Submit", className: showFrom.xl },
              { label: "Status", className: showFrom.sm },
              { label: "Action" },
            ]}
          >
            {result.rows.map((row) => (
              <tr key={row.id} className="hover:bg-canvas/80">
                <Cell>
                  <span className="block font-medium wrap-anywhere text-ink">{row.trackingNumber ?? <span className="font-normal text-faint">Not given yet</span>}</span>
                  {/* What the hidden columns show, repeated for small screens. */}
                  <div className="mt-1 space-y-0.5 text-[0.8125rem] wrap-anywhere text-muted lg:hidden">
                    {!isEnterprise && <span className="block md:hidden">{row.enterpriseName}</span>}
                    <span className="block">{row.transactionName}</span>
                    <span className="block">
                      Created <LocalTime value={row.createdAt} />
                    </span>
                    <span className="mt-1 block sm:hidden">
                      <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                      {row.remarks && <span className="mt-1 block text-danger">{row.remarks}</span>}
                    </span>
                  </div>
                </Cell>
                {!isEnterprise && (
                  <Cell className={cx(showFrom.md, "wrap-anywhere text-ink-soft")}>
                    {row.enterpriseName}
                    <span className="block text-[0.8125rem] text-muted">{row.enterpriseCode}</span>
                  </Cell>
                )}
                <Cell className={cx(showFrom.lg, "wrap-anywhere text-ink-soft")}>{row.transactionName}</Cell>
                <Cell className={cx(showFrom.lg, "whitespace-nowrap text-ink-soft")}>
                  <LocalTime value={row.createdAt} />
                </Cell>
                {showFormSaved && (
                  <Cell className={cx(showFrom.xl, "whitespace-nowrap text-ink-soft")}>
                    <LocalTime value={row.formSavedAt} />
                  </Cell>
                )}
                <Cell className={cx(showFrom.xl, "whitespace-nowrap text-ink-soft")}>
                  <LocalTime value={row.submittedAt} />
                </Cell>
                <Cell className={showFrom.sm}>
                  <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                  {row.remarks && <span className="mt-1 block max-w-64 text-[0.8125rem] wrap-anywhere text-danger">{row.remarks}</span>}
                </Cell>
                <Cell>
                  <RowActionButtons kind={kind} path={path} member={member} row={row} deleteAction={deleteAction} />
                </Cell>
              </tr>
            ))}
          </Table>
          <Pager total={result.total} noun={[noun, `${noun}s`]} page={filter.page} pageCount={pageCount} pageHref={(page) => listHref(path, filters, page)} />
        </>
      )}
    </div>
  );
}

/** A row's View, Edit and Delete, as its role and status allow. Delete asks first. */
function RowActionButtons({
  kind,
  path,
  member,
  row,
  deleteAction,
}: Pick<SubmissionListProps, "kind" | "path" | "member" | "deleteAction"> & { row: ListPage["rows"][number] }) {
  const actions = rowActions(kind, member.role, row.status);
  if (actions.length === 0) return <span className="text-faint">—</span>;
  const name = row.trackingNumber ?? `this ${kind}`;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {actions.includes("view") && (
        <Link href={`${path}/${row.id}`} className={buttonClasses("ghost", "sm")} aria-label={`View ${name}`}>
          <Eye aria-hidden /> View
        </Link>
      )}
      {actions.includes("edit") && (
        <Link href={`${path}/${row.id}/edit`} className={buttonClasses("ghost", "sm")} aria-label={`Edit ${name}`}>
          <Pencil aria-hidden /> Edit
        </Link>
      )}
      {actions.includes("delete") && (
        <ActionForm action={deleteAction} hidden={{ id: row.id }} className="flex flex-col gap-1">
          <ConfirmDialogButton
            size="sm"
            label={`Delete ${name}`}
            title={`Delete this ${kind}?`}
            message={
              <>
                <span className="font-medium text-ink">{name}</span> will be deleted and removed from your list.
              </>
            }
            confirmLabel="Delete"
          >
            <Trash2 aria-hidden /> Delete
          </ConfirmDialogButton>
          <FormMessage successMessage={false} />
        </ActionForm>
      )}
    </div>
  );
}
