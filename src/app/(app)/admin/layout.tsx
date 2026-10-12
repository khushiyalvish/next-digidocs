import type { ReactNode } from "react";
import { requireRole } from "@/features/auth/guards";

/**
 * Administration (the "Administration" dropdown). Anyone but an LFZ Admin gets 404 here, and again
 * in every admin page and action.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRole("lfz_admin");
  return <>{children}</>;
}
