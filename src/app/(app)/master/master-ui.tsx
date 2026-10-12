import type { ReactNode } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Badge, controlHeight, inputClasses } from "@/components/ui/primitives";

/* Pieces the Master pages share. */

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>;
}

/** A list's search box and status filter, as a plain GET form (the filters live in the address bar). */
export function ListFilters({
  path,
  q,
  status,
  placeholder,
  filtered,
  children,
}: {
  path: string;
  q?: string;
  status?: string;
  placeholder: string;
  /** Any filter in use: shows "Clear". */
  filtered: boolean;
  /** More selects, e.g. the port kind. */
  children?: ReactNode;
}) {
  return (
    <form method="get" action={path} className="mb-4 flex flex-wrap gap-2">
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder={placeholder}
          aria-label={placeholder}
          className={cx(inputClasses, controlHeight, "pl-9")}
        />
      </div>
      {children}
      <select name="status" defaultValue={status ?? ""} aria-label="Status" className={cx(inputClasses, controlHeight, "w-auto flex-1 pr-8 sm:flex-none")}>
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <button type="submit" className={buttonClasses("secondary")}>
        Filter
      </button>
      {filtered && (
        <Link href={path} className={buttonClasses("ghost")}>
          Clear
        </Link>
      )}
    </form>
  );
}
