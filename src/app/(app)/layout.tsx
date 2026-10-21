import type { ReactNode } from "react";
import { getConfig } from "@/lib/config";
import { menuFor } from "@/features/access/menu";
import { requireUser } from "@/features/auth/guards";
import { AppHeader } from "./app-header";

/**
 * Everything behind sign-in: the top bar (the suite's shell with DigiDocs's dropdown menus —
 * decision log 2026-10-12), the page, and the LFZ footer. The guard here is a convenience for the
 * shell (it needs the person's name and role); every page and action below still runs its own
 * guard.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const { appName, onePortal } = getConfig();
  const sections = user.role
    ? menuFor(user.role).map(({ href, label, items }) => ({ href, label, items: items.map((item) => ({ href: item.href, label: item.label })) }))
    : [];

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        appName={appName}
        sections={sections}
        fullName={user.fullName}
        email={user.email}
        hubAccountUrl={`${onePortal.url}/account`}
      />
      <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-10 lg:px-8 2xl:max-w-7xl">{children}</main>
      <footer className="border-t border-line bg-surface px-4 py-3 text-center text-xs text-muted">
        Copyright © {new Date().getFullYear()} All rights reserved. LAGOS FREE ZONE
      </footer>
    </div>
  );
}
