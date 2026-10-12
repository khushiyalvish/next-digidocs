import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Landmark } from "lucide-react";
import { requireMenuItem } from "@/features/auth/guards";
import { createBank } from "@/features/masters/actions";
import { listBanks } from "@/features/masters/queries";
import { ActionForm, FormMessage, SubmitButton, TextField } from "@/components/forms/action-form";
import { Card, CardBody, CardFooter, CardHeader, EmptyState } from "@/components/ui/primitives";
import { Cell, Table } from "@/components/ui/table";
import { ActiveBadge } from "../master-ui";
import { menuTrail } from "@/features/access/menu";
import { PageTitle } from "@/app/(app)/page-title";

export const metadata: Metadata = { title: "Banks" };

/** Banks (old DigiDocs: Bank/Banks): add on the left, the list on the right; a row opens it for editing. */
export default async function BanksPage() {
  await requireMenuItem("/master/banks");
  const banks = await listBanks();

  return (
    <div>
      <PageTitle trail={menuTrail("/master/banks")} title="Banks" description="The banks importers and exporters choose from." />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title="Add bank" />
          <ActionForm action={createBank} resetOnSuccess>
            <CardBody className="space-y-4">
              <TextField name="bankName" label="Bank name" autoComplete="off" required />
              <FormMessage />
            </CardBody>
            <CardFooter>
              <SubmitButton>Add bank</SubmitButton>
            </CardFooter>
          </ActionForm>
        </Card>

        {banks.length === 0 ? (
          <EmptyState icon={Landmark} title="No banks yet" description="Add the first one." />
        ) : (
          <Table columns={[{ label: "Bank" }, { label: "Status" }, { label: "", className: "w-8" }]}>
            {banks.map((bank) => (
              <tr key={bank.id} className="hover:bg-canvas/80">
                <Cell>
                  <Link href={`/master/banks/${bank.id}`} className="block font-medium wrap-anywhere text-ink hover:underline">
                    {bank.bankName}
                  </Link>
                </Cell>
                <Cell>
                  <ActiveBadge isActive={bank.isActive} />
                </Cell>
                <Cell className="w-8 pl-0 text-faint">
                  <ChevronRight className="size-4" aria-hidden />
                </Cell>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}
