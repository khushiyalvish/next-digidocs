import type { Metadata } from "next";
import { Ship } from "lucide-react";
import { requireMenuItem } from "@/features/auth/guards";
import { listOrganisationOptions } from "@/features/organisations/queries";
import { listTransactionTypeOptions } from "@/features/reference/queries";
import { listExports } from "@/features/exports/queries";
import { listFilterSchema } from "@/features/workflow/list";
import { SubmissionList } from "@/app/(app)/submission-list";

export const metadata: Metadata = { title: "List Export" };

/** Exports (old DigiDocs: Export/ListExport). */
export default async function ExportsPage({ searchParams }: PageProps<"/exports">) {
  const member = await requireMenuItem("/exports");
  const filter = listFilterSchema.parse(await searchParams);
  const [result, transactionTypes, enterprises] = await Promise.all([
    listExports(member, filter),
    listTransactionTypeOptions(),
    member.role === "enterprise" ? Promise.resolve([]) : listOrganisationOptions(),
  ]);

  return (
    <SubmissionList
      kind="export"
      path="/exports"
      member={member}
      filter={filter}
      result={result}
      transactionTypes={transactionTypes.filter((type) => type.direction === "export")}
      enterprises={enterprises}
      icon={Ship}
    />
  );
}
