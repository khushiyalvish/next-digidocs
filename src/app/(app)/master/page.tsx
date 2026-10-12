import { redirect } from "next/navigation";
import { requireMenuItem } from "@/features/auth/guards";

/** /master has no page of its own: it opens on Agents. */
export default async function MasterPage() {
  await requireMenuItem("/master");
  redirect("/master/agents");
}
