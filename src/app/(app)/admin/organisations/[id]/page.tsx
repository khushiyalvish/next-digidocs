import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { menuTrail } from "@/features/access/menu";
import { idSchema } from "@/lib/schemas";
import { requireRole } from "@/features/auth/guards";
import { saveOrganisation } from "@/features/organisations/actions";
import { getOrganisation } from "@/features/organisations/queries";
import { ActionForm, CheckboxField, FormMessage, SubmitButton } from "@/components/forms/action-form";
import { Alert, Card, CardBody, CardFooter, CardHeader } from "@/components/ui/primitives";
import { OrganisationStatusBadge } from "../../badges";
import { PageTitle } from "@/app/(app)/page-title";
import { OrganisationFields } from "../organisation-fields";

export const metadata: Metadata = { title: "Organisation" };

export default async function OrganisationPage({ params, searchParams }: PageProps<"/admin/organisations/[id]">) {
  await requireRole("lfz_admin");
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();

  const organisation = await getOrganisation(id.data);
  if (!organisation) notFound();
  const { notice } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        trail={[...menuTrail("/admin/organisations"), { label: organisation.companyName }]}
        title={organisation.companyName}
        badge={<OrganisationStatusBadge isActive={organisation.isActive} isLicenceExpired={organisation.isLicenceExpired} />}
        description={
          <>
            {organisation.shortCode} ·{" "}
            <Link href={`/admin/users?q=${encodeURIComponent(organisation.companyName)}`} className="underline underline-offset-2 hover:text-ink">
              {organisation.userCount} {organisation.userCount === 1 ? "user" : "users"}
            </Link>
          </>
        }
      />

      {notice === "created" && (
        <Alert tone="success" className="mb-6">
          Organisation added. Link its staff to it on the Users page once they have opened DigiDocs.
        </Alert>
      )}

      <Card>
        <CardHeader title="Details" />
        <ActionForm action={saveOrganisation} hidden={{ organisationId: organisation.id }}>
          <CardBody className="space-y-4">
            <OrganisationFields organisation={organisation} />
            <CheckboxField
              name="isActive"
              label="Active"
              description="Unticking takes DigiDocs access away from this organisation's users at their next page. Nothing is deleted."
              defaultChecked={organisation.isActive}
            />
            <FormMessage />
          </CardBody>
          <CardFooter>
            <SubmitButton>Save changes</SubmitButton>
          </CardFooter>
        </ActionForm>
      </Card>
    </div>
  );
}
