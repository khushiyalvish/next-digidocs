import { TextField } from "@/components/forms/action-form";
import type { OrganisationDetailDto } from "@/features/organisations/queries";

/** The fields of an organisation, shared by "Add organisation" and the organisation's page. */
export function OrganisationFields({ organisation }: { organisation?: OrganisationDetailDto }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <TextField name="companyName" label="Company name" defaultValue={organisation?.companyName} autoComplete="off" required />
        </div>
        <TextField
          name="shortCode"
          label="Short code"
          hint="e.g. LPLELTD"
          defaultValue={organisation?.shortCode}
          autoComplete="off"
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="registrationNumber"
          label="Registration number"
          defaultValue={organisation?.registrationNumber ?? ""}
          autoComplete="off"
        />
        <TextField name="registrationDate" label="Registration date" type="date" defaultValue={organisation?.registrationDate ?? ""} />
        <TextField
          name="licenceNumber"
          label="Operating licence number"
          defaultValue={organisation?.licenceNumber ?? ""}
          autoComplete="off"
        />
        <TextField name="licenceExpiresOn" label="Licence expires on" type="date" defaultValue={organisation?.licenceExpiresOn ?? ""} />
        <TextField
          name="orionCode"
          label="Orion code"
          hint="The company's code in Orion, for revenue (e.g. TDLC-LPLELTD)."
          defaultValue={organisation?.orionCode ?? ""}
          autoComplete="off"
        />
      </div>
    </>
  );
}
