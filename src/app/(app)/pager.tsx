import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

/** "n items · Page x of y · Previous / Next" under an administration list. */
export function Pager({
  total,
  noun,
  page,
  pageCount,
  pageHref,
}: {
  total: number;
  noun: [singular: string, plural: string];
  page: number;
  pageCount: number;
  pageHref: (page: number) => string;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <span>
        {total} {total === 1 ? noun[0] : noun[1]}
      </span>
      {pageCount > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Page {page} of {pageCount}
          </span>
          <Link
            href={pageHref(page - 1)}
            aria-disabled={page <= 1}
            className={buttonClasses("secondary", "sm", page <= 1 ? "pointer-events-none opacity-50" : undefined)}
          >
            <ChevronLeft aria-hidden /> Previous
          </Link>
          <Link
            href={pageHref(page + 1)}
            aria-disabled={page >= pageCount}
            className={buttonClasses("secondary", "sm", page >= pageCount ? "pointer-events-none opacity-50" : undefined)}
          >
            Next <ChevronRight aria-hidden />
          </Link>
        </div>
      )}
    </div>
  );
}

/** The list's address with its filters and a page number (page 1 is left out). */
export function listHref(path: string, filters: Record<string, string | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
