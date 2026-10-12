import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { idSchema } from "@/lib/schemas";
import { requireMenuItem } from "@/features/auth/guards";
import { saveBank } from "@/features/masters/actions";
import { getBank } from "@/features/masters/queries";
import { ActionForm, CheckboxField, FormMessage, SubmitButton, TextField } from "@/components/forms/action-form";
import { Card, CardBody, CardFooter } from "@/components/ui/primitives";
import { menuTrail } from "@/features/access/menu";
import { PageTitle } from "@/app/(app)/page-title";

export const metadata: Metadata = { title: "Bank" };

export default async function BankPage({ params }: PageProps<"/master/banks/[id]">) {
  await requireMenuItem("/master/banks");
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const bank = await getBank(id.data);
  if (!bank) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle trail={[...menuTrail("/master/banks"), { label: bank.bankName }]} title={bank.bankName} />
      <Card>
        <ActionForm action={saveBank} hidden={{ bankId: bank.id }}>
          <CardBody className="space-y-4">
            <TextField name="bankName" label="Bank name" defaultValue={bank.bankName} autoComplete="off" required />
            <CheckboxField
              name="isActive"
              label="Active"
              description="An inactive bank is no longer offered in forms. Nothing is deleted."
              defaultChecked={bank.isActive}
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
