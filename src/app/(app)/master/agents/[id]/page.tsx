import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { idSchema } from "@/lib/schemas";
import { requireMenuItem } from "@/features/auth/guards";
import { saveAgent } from "@/features/masters/actions";
import { getAgent } from "@/features/masters/queries";
import { ActionForm, CheckboxField, FormMessage, SubmitButton } from "@/components/forms/action-form";
import { Card, CardBody, CardFooter } from "@/components/ui/primitives";
import { AgentFields } from "../agent-fields";
import { menuTrail } from "@/features/access/menu";
import { PageTitle } from "@/app/(app)/page-title";

export const metadata: Metadata = { title: "Clearing agent" };

/** Old DigiDocs: ClearingAgent/Edit. */
export default async function AgentPage({ params }: PageProps<"/master/agents/[id]">) {
  await requireMenuItem("/master/agents");
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const agent = await getAgent(id.data);
  if (!agent) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle trail={[...menuTrail("/master/agents"), { label: agent.agentName }]} title={agent.agentName} />
      <Card>
        <ActionForm action={saveAgent} hidden={{ agentId: agent.id }}>
          <CardBody className="space-y-4">
            <AgentFields agent={agent} />
            <CheckboxField
              name="isActive"
              label="Active"
              description="An inactive agent is no longer offered in forms. Nothing is deleted."
              defaultChecked={agent.isActive}
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
