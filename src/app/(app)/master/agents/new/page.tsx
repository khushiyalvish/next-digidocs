import type { Metadata } from "next";
import { requireMenuItem } from "@/features/auth/guards";
import { createAgent } from "@/features/masters/actions";
import { ActionForm, FormMessage, SubmitButton } from "@/components/forms/action-form";
import { Card, CardBody, CardFooter } from "@/components/ui/primitives";
import { AgentFields } from "../agent-fields";
import { menuTrail } from "@/features/access/menu";
import { PageTitle } from "@/app/(app)/page-title";

export const metadata: Metadata = { title: "Add Agent" };

/** Old DigiDocs: ClearingAgent/Add — a separate page that returns to the list. */
export default async function NewAgentPage() {
  await requireMenuItem("/master/agents/new");

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle trail={menuTrail("/master/agents/new")} title="Add clearing agent" />
      <Card>
        <ActionForm action={createAgent}>
          <CardBody className="space-y-4">
            <AgentFields />
            <FormMessage />
          </CardBody>
          <CardFooter>
            <SubmitButton>Add agent</SubmitButton>
          </CardFooter>
        </ActionForm>
      </Card>
    </div>
  );
}
