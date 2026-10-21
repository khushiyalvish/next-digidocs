import type { Metadata } from "next";
import { requireMenuItem } from "@/features/auth/guards";
import { getExport } from "@/features/exports/queries";
import { loadRecord, SubmissionRecord } from "@/app/(app)/submission-record";

export const metadata: Metadata = { title: "Export" };

/** View one export (old ImpExp/ViewExp), from the list's Action column. */
export default async function ViewExportPage({ params }: PageProps<"/exports/[id]">) {
  const member = await requireMenuItem("/exports");
  const record = await loadRecord(member, "export", "view", (await params).id, getExport);
  return <SubmissionRecord kind="export" action="view" record={record} />;
}
