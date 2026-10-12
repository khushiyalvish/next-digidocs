import type { Metadata } from "next";
import { requireMenuItem } from "@/features/auth/guards";
import { ComingSoon, menuTitle } from "@/app/(app)/section";

export const metadata: Metadata = { title: menuTitle("/reports/amendments") };

export default async function Page() {
  await requireMenuItem("/reports/amendments");
  return <ComingSoon href="/reports/amendments" />;
}
