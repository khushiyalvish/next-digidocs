"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronDown, Menu, X } from "lucide-react";
import { Brand } from "@/components/shell/brand";
import { UserMenu } from "@/components/shell/user-menu";
import { cx } from "@/components/ui/cx";

/*
 * The DigiDocs top bar: the suite's shell (hub CHILD-APP-GUIDE §7.1: the hub's bar, the kit's
 * Brand and UserMenu, "Back to OnePortal") with one difference, recorded in the decision log
 * (2026-10-12): DigiDocs's sections are dropdowns, because it has far more pages than the hub.
 * From xl the sections sit in the bar; from md in a second row; on phones behind a menu button.
 */

export interface HeaderSection {
  href: string;
  label: string;
  items: { href: string; label: string }[];
}

export function AppHeader({
  appName,
  sections,
  fullName,
  email,
  hubAccountUrl,
}: {
  appName: string;
  sections: HeaderSection[];
  fullName: string;
  email: string;
  hubAccountUrl: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null); // a section's href, or "mobile"
  const headerRef = useRef<HTMLElement>(null);

  // Close whatever is open on navigation, on a click outside the header, and on Escape.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(null);
  }
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = (key: string) => setOpen((current) => (current === key ? null : key));
  const isCurrent = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const sectionCurrent = (section: HeaderSection) =>
    isCurrent(section.href) || section.items.some((item) => isCurrent(item.href));

  // One list, rendered in the bar (xl) or in the second row (md to xl): only one is visible.
  const sectionList = (
    <ul className="flex items-center gap-1">
      {sections.map((section) => {
        const current = sectionCurrent(section);
        const itemClasses = cx(
          "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
          current ? "bg-header-hover text-header-ink" : "text-header-muted hover:text-header-ink",
        );
        if (section.items.length === 0) {
          return (
            <li key={section.href}>
              <Link href={section.href} aria-current={current ? "page" : undefined} className={itemClasses}>
                {section.label}
              </Link>
            </li>
          );
        }
        return (
          <li key={section.href} className="relative">
            <button
              type="button"
              onClick={() => toggle(section.href)}
              aria-expanded={open === section.href}
              aria-haspopup="menu"
              className={itemClasses}
            >
              {section.label}
              <ChevronDown className={cx("size-3.5 transition-transform", open === section.href && "rotate-180")} aria-hidden />
            </button>
            {open === section.href && (
              <div
                role="menu"
                className="absolute left-0 z-50 mt-1.5 w-[min(17rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-lg shadow-ink/5"
              >
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    aria-current={pathname === item.href ? "page" : undefined}
                    className={cx(menuItemClasses, pathname === item.href && "bg-subtle text-ink")}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-header-line bg-header/90 backdrop-blur supports-[backdrop-filter]:bg-header/75"
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8 2xl:max-w-7xl">
        <Link href="/" className="min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-header-ink/30">
          <Brand name={appName} onHeader />
        </Link>

        {sections.length > 0 && (
          <nav aria-label="Main" className="hidden xl:block">
            {sectionList}
          </nav>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <a
            href="/sso/leave"
            aria-label="Back to OnePortal"
            className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-medium text-header-muted transition-colors hover:bg-header-hover hover:text-header-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-header-ink/30 sm:min-h-0 sm:py-1.5"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span className="hidden sm:inline">Back to OnePortal</span>
          </a>
          <UserMenu fullName={fullName} email={email} hubAccountUrl={hubAccountUrl} />
          {sections.length > 0 && (
            <button
              type="button"
              onClick={() => toggle("mobile")}
              aria-expanded={open === "mobile"}
              aria-label={open === "mobile" ? "Close menu" : "Open menu"}
              className="flex size-10 items-center justify-center rounded-md text-header-ink hover:bg-header-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-header-ink/30 md:hidden"
            >
              {open === "mobile" ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          )}
        </div>
      </div>

      {/* Second row, md to xl: the sections do not fit beside the brand there. */}
      {sections.length > 0 && (
        <nav aria-label="Main" className="hidden border-t border-header-line/60 md:block xl:hidden">
          <div className="mx-auto max-w-6xl px-4 py-1.5 sm:px-6 lg:px-8">{sectionList}</div>
        </nav>
      )}

      {/* Phones: the whole menu, items listed under their section. */}
      {open === "mobile" && (
        <nav aria-label="Main" className="max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-header-line/60 px-4 py-3 md:hidden">
          <ul className="space-y-1">
            {sections.map((section) => (
              <li key={section.href}>
                {section.items.length === 0 ? (
                  <Link href={section.href} className={mobileLinkClasses(isCurrent(section.href))}>
                    {section.label}
                  </Link>
                ) : (
                  <>
                    <p className="px-3 pt-2 pb-1 text-xs font-medium tracking-wider text-header-muted uppercase">{section.label}</p>
                    <ul>
                      {section.items.map((item) => (
                        <li key={item.href}>
                          <Link href={item.href} className={mobileLinkClasses(pathname === item.href, true)}>
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

const menuItemClasses =
  "flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm text-ink-soft hover:bg-subtle hover:text-ink sm:py-2";

function mobileLinkClasses(current: boolean, indented = false): string {
  return cx(
    "flex min-h-10 items-center rounded-md px-3 text-sm font-medium",
    indented && "pl-5",
    current ? "bg-header-hover text-header-ink" : "text-header-muted hover:text-header-ink",
  );
}
