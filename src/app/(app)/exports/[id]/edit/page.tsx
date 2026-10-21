import type { Metadata } from "next";
import { requireMenuItem } from "@/features/auth/guards";
import { getExport } from "@/features/exports/queries";
import { loadRecord, SubmissionRecord } from "@/app/(app)/submission-record";

export const metadata: Metadata = { title: "Edit export" };

/** Edit one export: an Enterprise user's draft or rejected export, from the list's Action column. */
export default async function EditExportPage({ params }: PageProps<"/exports/[id]/edit">) {
  const member = await requireMenuItem("/exports");
  const record = await loadRecord(member, "export", "edit", (await params).id, getExport);
  return <SubmissionRecord kind="export" action="edit" record={record} />;
}
