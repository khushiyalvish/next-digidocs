import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Hourglass } from "lucide-react";
import { requireUser } from "@/features/auth/guards";
import { EmptyState } from "@/components/ui/primitives";
import { PageTitle } from "@/app/(app)/page-title";

export const metadata: Metadata = { title: "Waiting for access" };

/**
 * Where a signed-in person without a role lands (requireMember). OnePortal let them open
 * DigiDocs; an LFZ Admin still has to say what they may do here.
 */
export default async function NoAccessPage() {
  const user = await requireUser();
  if (user.role) redirect("/");

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle trail={[{ label: "Home" }]} title={`Welcome, ${user.fullName.split(" ")[0] || user.fullName}`} />
      <EmptyState
        icon={Hourglass}
        title="Your account is waiting for access"
        description={
          user.organisationId
            ? "Your organisation is deactivated in DigiDocs. Contact the Lagos Free Zone administrators."
            : "An LFZ administrator needs to give you a role (and, for enterprise staff, your organisation). Open DigiDocs again from OnePortal once they have."
        }
      />
    </div>
  );
}
