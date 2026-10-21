import { notFound } from "next/navigation";
import { Construction } from "lucide-react";
import { idSchema } from "@/lib/schemas";
import { menuTrail } from "@/features/access/menu";
import type { Member } from "@/features/auth/guards";
import { canDo, type RowAction, type SubmissionKind } from "@/features/workflow/actions";
import type { ListRowDto } from "@/features/workflow/list";
import { STATUS_LABELS, STATUS_TONES } from "@/features/workflow/statuses";
import { LocalTime } from "@/components/local-time";
import { Badge, Card, CardBody, DescriptionList, EmptyState } from "@/components/ui/primitives";
import { PageTitle } from "@/app/(app)/page-title";

/*
 * The View and Edit pages of one import or export (the list's Action column links here). Until
 * Add Import and Add Export exist they show what the list knows about the record and say which
 * module brings the form. The page has run its guard; this checks the id, the record's scope
 * (the getter: 404 when out of reach) and the row rule for the action (features/workflow/actions.ts).
 */

/** The record, or 404: malformed id, not found, out of the member's reach, or the action not allowed. */
export async function loadRecord(
  member: Member,
  kind: SubmissionKind,
  action: RowAction,
  rawId: string,
  get: (member: Member, id: string) => Promise<ListRowDto | null>,
): Promise<ListRowDto> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) notFound();
  const record = await get(member, id.data);
  if (!record || !canDo(kind, member.role, record.status, action)) notFound();
  return record;
}

export function SubmissionRecord({
  kind,
  action,
  record,
}: {
  kind: SubmissionKind;
  action: "view" | "edit";
  record: ListRowDto;
}) {
  const path = kind === "import" ? "/imports" : "/exports";
  const Noun = kind === "import" ? "Import" : "Export";
  const name = record.trackingNumber ?? "No tracking number yet";
  const title = action === "edit" ? `Edit ${kind}: ${name}` : `${Noun} ${name}`;
  const comingIn = kind === "import" ? "module 4 (Import)" : "module 5 (Export)";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle
        trail={[...menuTrail(path), { label: action === "edit" ? `Edit ${name}` : name }]}
        title={title}
        badge={<Badge tone={STATUS_TONES[record.status]}>{STATUS_LABELS[record.status]}</Badge>}
      />
      <Card>
        <CardBody>
          <DescriptionList
            items={[
              { label: "Tracking No", value: record.trackingNumber ?? <span className="text-faint">Not given yet</span> },
              { label: "Enterprise", value: `${record.enterpriseName} (${record.enterpriseCode})` },
              { label: "Particular", value: record.transactionName },
              { label: "Status", value: STATUS_LABELS[record.status] },
              ...(record.remarks ? [{ label: "Remarks", value: <span className="text-danger">{record.remarks}</span> }] : []),
              { label: "Created", value: <LocalTime value={record.createdAt} /> },
              ...(kind === "import" ? [{ label: "Form Modified", value: <LocalTime value={record.formSavedAt} /> }] : []),
              { label: "Final Submit", value: <LocalTime value={record.submittedAt} /> },
            ]}
          />
        </CardBody>
      </Card>
      <EmptyState
        icon={Construction}
        title={action === "edit" ? `Editing comes with ${comingIn}` : `The full ${kind} comes with ${comingIn}`}
        description={
          kind === "import"
            ? "Key information, items (HSE codes), containers, invoices and documents."
            : "Key information, HSE codes, items, tracking and documents."
        }
      />
    </div>
  );
}
