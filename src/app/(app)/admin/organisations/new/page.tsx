import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/features/auth/guards";
import { createOrganisation } from "@/features/organisations/actions";
import { ActionForm, FormMessage, SubmitButton } from "@/components/forms/action-form";
import { Card, CardBody, CardFooter } from "@/components/ui/primitives";
import { OrganisationFields } from "../organisation-fields";
import { menuTrail } from "@/features/access/menu";
import { PageTitle } from "@/app/(app)/page-title";

export const metadata: Metadata = { title: "Add organisation" };

export default async function NewOrganisationPage() {
  await requireRole("lfz_admin");

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/organisations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" aria-hidden /> Organisations
      </Link>
      <PageTitle trail={[...menuTrail("/admin/organisations"), { label: "Add organisation" }]} title="Add organisation" description="A free-zone enterprise. Its staff are linked to it on the Users page." />
      <Card>
        <ActionForm action={createOrganisation}>
          <CardBody className="space-y-4">
            <OrganisationFields />
            <FormMessage />
          </CardBody>
          <CardFooter>
            <SubmitButton>Add organisation</SubmitButton>
          </CardFooter>
        </ActionForm>
      </Card>
    </div>
  );
}
