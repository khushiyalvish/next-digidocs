import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/guards";

/** /admin has no page of its own yet: it opens on Users. */
export default async function AdminPage() {
  await requireRole("lfz_admin");
  redirect("/admin/users");
}
