import type { Metadata } from "next";
import { requireMenuItem } from "@/features/auth/guards";
import { ComingSoon, menuTitle } from "@/app/(app)/section";

export const metadata: Metadata = { title: menuTitle("/reports/export-final") };

export default async function Page() {
  await requireMenuItem("/reports/export-final");
  return <ComingSoon href="/reports/export-final" />;
}
