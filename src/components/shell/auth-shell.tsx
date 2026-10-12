// Suite kit v7: copied from OnePortal src/components/shell/auth-shell.tsx. Change it in the hub first, then copy it here.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Brand } from "@/components/shell/brand";
import { HeroBackdrop } from "@/components/ui/primitives";

export interface AuthPoint {
  icon: LucideIcon;
  title: string;
  text: string;
}

/**
 * The frame of every signed-out page: from `lg` up, a panel in the theme's primary colour on the
 * left that says what the application is; the page's own card on the right. Below `lg` only the
 * card, under the brand.
 *
 * The panel shows wording only — never figures or names from the database: nobody has signed in yet.
 */
export function AuthShell({
  appName,
  organizationName,
  headline,
  description,
  points,
  children,
}: {
  appName: string;
  organizationName: string;
  headline: string;
  description: string;
  points: AuthPoint[];
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative isolate hidden flex-col justify-between gap-10 overflow-hidden bg-primary p-10 text-on-primary lg:flex xl:p-14">
        <HeroBackdrop />
        <Brand name={appName} size="lg" onPrimary />

        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight xl:text-4xl">{headline}</h2>
          <p className="mt-4 text-base text-on-primary/80">{description}</p>
          <ul className="mt-9 space-y-5">
            {points.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-on-primary/10 ring-1 ring-on-primary/15 ring-inset">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="mt-0.5 block text-sm text-on-primary/75">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-on-primary/70">{organizationName}</p>
      </aside>

      <main className="flex min-w-0 flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[27rem]">
          <div className="mb-6 flex justify-center sm:mb-8 lg:hidden">
            <Brand name={appName} size="lg" />
          </div>
          {children}
          <p className="mt-8 text-center text-xs text-faint lg:hidden">{organizationName}</p>
        </div>
      </main>
    </div>
  );
}
