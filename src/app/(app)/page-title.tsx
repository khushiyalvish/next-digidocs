import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import type { Crumb } from "@/features/access/menu";

/*
 * DigiDocs's page header, part of its own LFZ header design (decision log 2026-10-08): a
 * breadcrumb from the menu (features/access/menu.ts `menuTrail`), then a small title with the
 * brand mark beside it, a line of description and the page's actions, above a thin rule. Used
 * by every signed-in page instead of the kit's large PageHeader.
 */

/** Home › section › page. The last crumb is the current page: never a link. */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-muted">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          const content =
            index === 0 ? (
              <>
                <Home className="size-3.5 shrink-0" aria-hidden />
                <span className={last ? undefined : "sr-only sm:not-sr-only"}>{crumb.label}</span>
              </>
            ) : (
              <span className="wrap-anywhere">{crumb.label}</span>
            );
          return (
            <li key={`${index}-${crumb.label}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && <ChevronRight className="size-3 shrink-0 text-faint" aria-hidden />}
              {crumb.href && !last ? (
                <Link
                  href={crumb.href}
                  className="inline-flex min-h-6 items-center gap-1 rounded-sm hover:text-primary hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                >
                  {content}
                </Link>
              ) : (
                <span className={last ? "inline-flex items-center gap-1 font-medium text-ink-soft" : "inline-flex items-center gap-1"} aria-current={last ? "page" : undefined}>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageTitle({
  trail,
  title,
  description,
  actions,
  badge,
}: {
  trail: Crumb[];
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Shown beside the title, e.g. a status. */
  badge?: ReactNode;
}) {
  return (
    <div className="mb-6 border-b border-line pb-4">
      <Breadcrumbs trail={trail} />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span aria-hidden className="mt-0.5 w-1 shrink-0 self-stretch rounded-full bg-mark" />
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight wrap-anywhere text-ink sm:text-xl">
              {title}
              {badge}
            </h1>
            {description && <p className="mt-0.5 text-sm wrap-anywhere text-muted">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
