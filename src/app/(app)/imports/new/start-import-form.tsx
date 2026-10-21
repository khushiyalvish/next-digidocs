"use client";

import { useId } from "react";
import { ActionForm, FormMessage, useFormState } from "@/components/forms/action-form";
import { ConfirmDialogButton } from "@/components/confirm-dialog";
import { SearchableSelect } from "@/components/searchable-select";
import { startImport } from "@/features/imports/actions";

/** The Particular, then a confirmation: it cannot be changed once the tracking number exists. */
export function StartImportForm({ particulars }: { particulars: { id: string; label: string }[] }) {
  return (
    <ActionForm action={startImport} className="space-y-4">
      <ParticularSelect particulars={particulars} />
      <FormMessage />
      <ConfirmDialogButton
        tone="confirm"
        title="Confirm Particular Selection"
        message={
          <>
            You will not be able to change the <span className="font-semibold text-ink">Particular</span> after the tracking number is generated.
            <br />
            Are you sure you want to continue?
          </>
        }
        confirmLabel="Generate tracking number"
      >
        Continue
      </ConfirmDialogButton>
    </ActionForm>
  );
}

function ParticularSelect({ particulars }: { particulars: { id: string; label: string }[] }) {
  const id = useId();
  const { result } = useFormState();
  const error = result && !result.ok ? result.fieldErrors?.transactionTypeId : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        Particular<span className="text-danger"> *</span>
      </label>
      <SearchableSelect id={id} name="transactionTypeId" options={particulars} invalid={Boolean(error)} />
      {error && <p className="text-[0.8125rem] text-danger">{error}</p>}
    </div>
  );
}
