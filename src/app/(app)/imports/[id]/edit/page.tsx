import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { menuTrail } from "@/features/access/menu";
import { requireMenuItem } from "@/features/auth/guards";
import { blNumbersFor, defaultShippingMode, hasContainers, itemLayoutFor, keyFieldsFor } from "@/features/imports/form";
import { getImport, getImportForm, listImportDocuments } from "@/features/imports/queries";
import { listImportFormOptions, listTransactionTypeKeyFields } from "@/features/reference/queries";
import { STATUS_LABELS, STATUS_TONES } from "@/features/workflow/statuses";
import { Alert, Badge } from "@/components/ui/primitives";
import { PageTitle } from "@/app/(app)/page-title";
import { loadRecord } from "@/app/(app)/submission-record";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Edit import" };

/**
 * Add / edit an import (old ImpExp/AddImpExp, EditImpExp): an Enterprise user's draft, an import
 * LFTZ rejected, or one at "Enterprise Submit" (the list's Edit rule). It opens exactly as it was
 * saved.
 */
export default async function EditImportPage({ params }: PageProps<"/imports/[id]/edit">) {
  const member = await requireMenuItem("/imports");
  const record = await loadRecord(member, "import", "edit", (await params).id, getImport);
  const [form, options] = await Promise.all([getImportForm(member, record.id), listImportFormOptions()]);
  if (!form) notFound();

  const legacyId = form.particular.legacyId;
  // Which key fields this Particular shows, its labels, what Submit requires (migration 0010).
  const [keyFieldSettings, documents] = await Promise.all([listTransactionTypeKeyFields(form.particular.id), listImportDocuments(form.id)]);
  const settings = { legacyId, keyFields: keyFieldSettings };
  const dutyPaidFile = keyFieldSettings.find((field) => field.fieldKey === "dutyPaidFile");
  // The old form's choices for a new import: the shipping mode by Particular, and naira for Local Import / Local Purchase.
  const naira = options.currencies.find((currency) => currency.label.startsWith("NGN"));
  const defaults = {
    shippingMode: defaultShippingMode(legacyId) ?? undefined,
    consignmentCurrencyId: legacyId === 8 || legacyId === 9 ? naira?.id : undefined,
  };

  return (
    <div className="space-y-6">
      <PageTitle
        trail={[...menuTrail("/imports/new"), { label: form.trackingNumber ?? "Import" }]}
        title={form.status === "draft" ? "Add Import" : "Edit Import"}
        description={`${form.particular.name} · ${form.trackingNumber ?? ""}`}
        badge={<Badge tone={STATUS_TONES[form.status]}>{STATUS_LABELS[form.status]}</Badge>}
      />
      {record.remarks && <Alert tone="error">Returned by LFTZ: {record.remarks}</Alert>}
      <ImportForm
        form={form}
        options={options}
        keyFields={keyFieldsFor(settings)}
        blNumbers={blNumbersFor(settings)}
        itemLayout={itemLayoutFor(legacyId)}
        showContainers={hasContainers(legacyId)}
        defaults={defaults}
        documents={documents}
        dutyPaidFile={dutyPaidFile ? { label: dutyPaidFile.label, required: dutyPaidFile.required } : null}
      />
    </div>
  );
}
