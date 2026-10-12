import type { Metadata } from "next";
import { requireMenuItem } from "@/features/auth/guards";
import { ComingSoon, menuTitle } from "@/app/(app)/section";

export const metadata: Metadata = { title: menuTitle("/reports/import-final") };

export default async function Page() {
  await requireMenuItem("/reports/import-final");
  return <ComingSoon href="/reports/import-final" />;
}
