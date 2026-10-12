import type { Metadata } from "next";
import { requireMenuItem } from "@/features/auth/guards";
import { ComingSoon, menuTitle } from "@/app/(app)/section";

export const metadata: Metadata = { title: menuTitle("/reports/revenue") };

export default async function Page() {
  await requireMenuItem("/reports/revenue");
  return <ComingSoon href="/reports/revenue" />;
}
