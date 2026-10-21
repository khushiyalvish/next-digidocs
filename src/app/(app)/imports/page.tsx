import type { Metadata } from "next";
import { PackageOpen } from "lucide-react";
import { requireMenuItem } from "@/features/auth/guards";
import { listOrganisationOptions } from "@/features/organisations/queries";
import { listTransactionTypeOptions } from "@/features/reference/queries";
import { deleteImport } from "@/features/imports/actions";
import { listImports } from "@/features/imports/queries";
import { listFilterSchema } from "@/features/workflow/list";
import { SubmissionList } from "@/app/(app)/submission-list";

export const metadata: Metadata = { title: "List Import" };

/** Imports (old DigiDocs: ImpExp/ListImpExp). The dashboard's cards open it at their step. */
export default async function ImportsPage({ searchParams }: PageProps<"/imports">) {
  const member = await requireMenuItem("/imports");
  const filter = listFilterSchema.parse(await searchParams);
  const [result, transactionTypes, enterprises] = await Promise.all([
    listImports(member, filter),
    listTransactionTypeOptions(),
    member.role === "enterprise" ? Promise.resolve([]) : listOrganisationOptions(),
  ]);

  return (
    <SubmissionList
      kind="import"
      path="/imports"
      member={member}
      filter={filter}
      result={result}
      transactionTypes={transactionTypes.filter((type) => type.direction === "import")}
      enterprises={enterprises}
      icon={PackageOpen}
      deleteAction={deleteImport}
    />
  );
}
