import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireMenuItem } from "@/features/auth/guards";
import { blNumbersFor, hasContainers, itemLayoutFor, keyFieldsFor } from "@/features/imports/form";
import { getImport, getImportView, listImportDocuments, listImportSteps } from "@/features/imports/queries";
import { listTransactionTypeKeyFields } from "@/features/reference/queries";
import { canDo } from "@/features/workflow/actions";
import { reviewSteps } from "@/features/workflow/review";
import { loadRecord } from "@/app/(app)/submission-record";
import { ImportView } from "./import-view";

export const metadata: Metadata = { title: "Import" };

/**
 * View one import (old ImpExp/ViewImpExp), from the list's Action column: anyone whose list shows
 * it (the list's scope and View rule, else 404). LFZ Admins and NEPZA also get the steps their
 * role may take at its status (features/workflow/review.ts).
 */
export default async function ViewImportPage({ params }: PageProps<"/imports/[id]">) {
  const member = await requireMenuItem("/imports");
  const record = await loadRecord(member, "import", "view", (await params).id, getImport);
  const [view, documents, steps] = await Promise.all([getImportView(record.id), listImportDocuments(record.id), listImportSteps(record.id)]);
  if (!view) notFound();
  const settings = { legacyId: view.particular.legacyId, keyFields: await listTransactionTypeKeyFields(view.particular.id) };

  return (
    <ImportView
      view={view}
      documents={documents}
      steps={steps}
      reviewSteps={reviewSteps(member.role, view.status)}
      keyFields={keyFieldsFor(settings)}
      blNumbers={blNumbersFor(settings)}
      itemLayout={itemLayoutFor(view.particular.legacyId)}
      showContainers={hasContainers(view.particular.legacyId)}
      canEdit={canDo("import", member.role, view.status, "edit")}
    />
  );
}
