import type { Metadata } from "next";
import { menuTrail } from "@/features/access/menu";
import { requireMenuItem } from "@/features/auth/guards";
import { listImportParticulars } from "@/features/reference/queries";
import { Card, CardBody } from "@/components/ui/primitives";
import { PageTitle } from "@/app/(app)/page-title";
import { StartImportForm } from "./start-import-form";

export const metadata: Metadata = { title: "Add Import" };

/**
 * Add Import, first step (old AddImpExp before the Particular was chosen): choosing the Particular
 * creates the draft with its tracking number and doc date at once, and opens the form. The
 * Particular cannot change afterwards (decision log 2026-10-14).
 */
export default async function AddImportPage() {
  await requireMenuItem("/imports/new");
  const particulars = await listImportParticulars();
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle trail={menuTrail("/imports/new")} title="Add Import" description="Choose the Particular to start. The tracking number is generated at once." />
      <Card>
        <CardBody>
          <StartImportForm particulars={particulars.map(({ id, label }) => ({ id, label }))} />
        </CardBody>
      </Card>
    </div>
  );
}
