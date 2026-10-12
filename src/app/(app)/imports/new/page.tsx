import type { Metadata } from "next";
import { requireMenuItem } from "@/features/auth/guards";
import { ComingSoon, menuTitle } from "@/app/(app)/section";

export const metadata: Metadata = { title: menuTitle("/imports/new") };

export default async function Page() {
  await requireMenuItem("/imports/new");
  return <ComingSoon href="/imports/new" />;
}
