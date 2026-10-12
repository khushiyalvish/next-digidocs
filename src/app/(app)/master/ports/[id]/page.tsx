import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { idSchema } from "@/lib/schemas";
import { requireMenuItem } from "@/features/auth/guards";
import { savePort } from "@/features/masters/actions";
import { getPort } from "@/features/masters/queries";
import { ActionForm, CheckboxField, FormMessage, SubmitButton } from "@/components/forms/action-form";
import { Card, CardBody, CardFooter } from "@/components/ui/primitives";
import { PortFields } from "../port-fields";
import { menuTrail } from "@/features/access/menu";
import { PageTitle } from "@/app/(app)/page-title";

export const metadata: Metadata = { title: "Port" };

export default async function PortPage({ params }: PageProps<"/master/ports/[id]">) {
  await requireMenuItem("/master/ports");
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const port = await getPort(id.data);
  if (!port) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle trail={[...menuTrail("/master/ports"), { label: port.portName }]} title={port.portName} />
      <Card>
        <ActionForm action={savePort} hidden={{ portId: port.id }}>
          <CardBody className="space-y-4">
            <PortFields port={port} />
            <CheckboxField
              name="isActive"
              label="Active"
              description="An inactive port is no longer offered in forms. Nothing is deleted."
              defaultChecked={port.isActive}
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
