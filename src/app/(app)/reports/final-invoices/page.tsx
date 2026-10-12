import type { Metadata } from "next";
import { requireMenuItem } from "@/features/auth/guards";
import { ComingSoon, menuTitle } from "@/app/(app)/section";

export const metadata: Metadata = { title: menuTitle("/reports/final-invoices") };

export default async function Page() {
  await requireMenuItem("/reports/final-invoices");
  return <ComingSoon href="/reports/final-invoices" />;
}
