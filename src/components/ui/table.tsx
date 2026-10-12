// Suite kit v7: copied from OnePortal src/components/ui/table.tsx. Change it in the hub first, then copy it here.
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/*
 * The admin tables: one look, one responsive pattern for all of them.
 *
 * On a phone a table shows only its first column; each further column appears from a
 * breakpoint (`showFrom`). Whatever is hidden must be repeated as a small line under the
 * first column's content, wrapped in the matching `…:hidden` class — nothing is lost on a
 * small screen, and the page never scrolls sideways.
 */

/** Use the same value on the column and on its cells. */
export const showFrom = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
} as const;

export interface Column {
  label: string;
  className?: string;
}

export function Table({ columns, children }: { columns: Column[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-xs">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-canvas/80">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                scope="col"
                className={cx(
                  "px-4 py-2.5 text-xs font-medium tracking-wide whitespace-nowrap text-muted uppercase",
                  column.className,
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">{children}</tbody>
      </table>
    </div>
  );
}

export function Cell({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("px-4 py-3 align-middle text-ink-soft", className)}>{children}</td>;
}
