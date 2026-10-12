import type { Metadata } from "next";
import { requireMenuItem } from "@/features/auth/guards";
import { ComingSoon, menuTitle } from "@/app/(app)/section";

export const metadata: Metadata = { title: menuTitle("/exports/new") };

export default async function Page() {
  await requireMenuItem("/exports/new");
  return <ComingSoon href="/exports/new" />;
}
