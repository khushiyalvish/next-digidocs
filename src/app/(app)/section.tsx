import { Construction } from "lucide-react";
import { menuItem, menuTrail } from "@/features/access/menu";
import { EmptyState } from "@/components/ui/primitives";
import { PageTitle } from "@/app/(app)/page-title";

/* The page shown for a menu entry (src/features/access/menu.ts) whose screen is not built yet. */

/** The page of a menu entry whose screen comes with a later module. */
export function ComingSoon({ href }: { href: string }) {
  const item = menuItem(href);
  const comingIn = item && "comingIn" in item ? item.comingIn : undefined;
  const summary = item && "summary" in item ? item.summary : undefined;
  return (
    <div>
      <PageTitle trail={menuTrail(href)} title={item?.label ?? "Coming soon"} />
      <EmptyState
        icon={Construction}
        title={comingIn ? `Coming with ${comingIn}` : "Coming soon"}
        description={summary ? `In the old DigiDocs: ${summary}` : undefined}
      />
    </div>
  );
}

/** <title> of a menu entry's page. */
export function menuTitle(href: string): string {
  return menuItem(href)?.label ?? "DigiDocs";
}
