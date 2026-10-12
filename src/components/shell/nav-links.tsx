// Suite kit v7: copied from OnePortal src/components/shell/nav-links.tsx. Change it in the hub first, then copy it here.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/cx";

export interface NavItem {
  href: string;
  label: string;
  /** Current only on exactly this address, not on the pages below it (an "Overview" tab). */
  exact?: boolean;
}

/**
 * Horizontal navigation. "top" sits on the top bar (header colours); "tabs" sits on the page,
 * with the current section underlined.
 */
export function NavLinks({ items, variant = "top" }: { items: NavItem[]; variant?: "top" | "tabs" }) {
  const pathname = usePathname();
  const isCurrent = (item: NavItem) =>
    item.exact || item.href === "/" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    // Tabs scroll inside their own box when a phone is too narrow for all of them; the page never does.
    <nav className={cx("flex items-center", variant === "top" ? "gap-1" : "gap-5 overflow-x-auto border-b border-line sm:gap-7")}>
      {items.map((item) => {
        const current = isCurrent(item);
        return variant === "top" ? (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cx(
              "rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors sm:py-1.5",
              current ? "bg-header-hover text-header-ink" : "text-header-muted hover:text-header-ink",
            )}
          >
            {item.label}
          </Link>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cx(
              "border-b-2 pt-1 pb-3 text-sm font-medium whitespace-nowrap transition-colors",
              current ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
