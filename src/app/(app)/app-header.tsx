"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronDown, Menu, UserRound, X } from "lucide-react";
import { LFZ_LOGO } from "@/components/lfz-logo";
import { cx } from "@/components/ui/cx";
import { Avatar } from "@/components/ui/primitives";

/*
 * The DigiDocs header, like the LFZ design (D:\Khushiyal\DigidocsNext): a stripe in the logo's
 * colours, a white row with the LFZ logo and the person, and a menu row with dropdowns. A
 * deliberate DigiDocs exception to the suite shell and to "kit components only" (decision log
 * 2026-10-08); it keeps the suite's rules otherwise: theme tokens only, "Back to OnePortal" as a
 * plain <a> (a prefetch would end the session), no sign-out, every width from 320 px.
 */

export interface HeaderSection {
  href: string;
  label: string;
  items: { href: string; label: string }[];
}

export function AppHeader({
  sections,
  fullName,
  email,
  roleLabel,
  hubAccountUrl,
}: {
  sections: HeaderSection[];
  fullName: string;
  email: string;
  roleLabel: string;
  hubAccountUrl: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null); // a section's href, "user" or "mobile"
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

  return (
    <header ref={headerRef} className="sticky top-0 z-40 shadow-sm shadow-ink/5">
      {/*
        The LFZ logo's colours: red-orange L, grey F, navy Z. Fixed, like the logo itself, in every
        theme: the one place DigiDocs uses colours that are not theme tokens (decision log 2026-10-08).
      */}
      <div aria-hidden className="flex h-1.5">
        <div className="flex-1 bg-[#f51f00]" />
        <div className="flex-1 bg-[#707070]" />
        <div className="flex-1 bg-[#001f57]" />
      </div>

      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:h-20 sm:px-6 lg:px-8 2xl:max-w-7xl">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:gap-4"
          >
            <Image {...LFZ_LOGO} alt={LFZ_LOGO.alt} unoptimized priority className="h-10 w-auto shrink-0 sm:h-12" />
            <span className="truncate border-l border-line pl-3 text-base font-semibold tracking-wide text-primary sm:pl-4 sm:text-lg">
              DigiDocs
            </span>
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <a
              href="/sso/leave"
              className="hidden min-h-10 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 lg:flex"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back to OnePortal
            </a>

            <div className="relative">
              <button
                type="button"
                onClick={() => toggle("user")}
                aria-expanded={open === "user"}
                aria-haspopup="menu"
                className="flex min-h-10 items-center gap-2.5 rounded-full py-1 pr-2 pl-1 text-left transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              >
                <Avatar name={fullName} size="md" />
                <span className="hidden max-w-48 leading-tight sm:block">
                  <span className="block truncate text-sm font-medium text-ink">{fullName}</span>
                  <span className="block truncate text-[0.8125rem] text-muted">{roleLabel}</span>
                </span>
                <ChevronDown className={cx("size-4 text-faint transition-transform", open === "user" && "rotate-180")} aria-hidden />
              </button>
              {open === "user" && (
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line bg-surface shadow-lg shadow-ink/5"
                >
                  <div className="border-b border-line-soft px-3.5 py-3">
                    <p className="truncate text-sm font-medium text-ink">{fullName}</p>
                    <p className="truncate text-[0.8125rem] text-muted">{email}</p>
                    <p className="truncate text-[0.8125rem] text-muted sm:hidden">{roleLabel}</p>
                  </div>
                  <div className="p-1">
                    <a href={hubAccountUrl} role="menuitem" className={menuItemClasses}>
                      <UserRound className="size-4 text-faint" aria-hidden />
                      OnePortal account
                    </a>
                    <a href="/sso/leave" role="menuitem" className={menuItemClasses}>
                      <ArrowLeft className="size-4 text-faint" aria-hidden />
                      Back to OnePortal
                    </a>
                  </div>
                </div>
              )}
            </div>

            {sections.length > 0 && (
              <button
                type="button"
                onClick={() => toggle("mobile")}
                aria-expanded={open === "mobile"}
                aria-label={open === "mobile" ? "Close menu" : "Open menu"}
                className="flex size-10 items-center justify-center rounded-md text-primary hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 md:hidden"
              >
                {open === "mobile" ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Menu row, from md. */}
      {sections.length > 0 && (
        <nav aria-label="Main" className="hidden bg-header md:block">
          <ul className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-1.5 sm:px-6 lg:px-8 2xl:max-w-7xl">
            {sections.map((section) => {
              const current = sectionCurrent(section);
              const itemClasses = cx(
                "flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
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
                    <ChevronDown className={cx("size-4 transition-transform", open === section.href && "rotate-180")} aria-hidden />
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
        </nav>
      )}

      {/* Phones: the whole menu, items listed under their section. */}
      {open === "mobile" && (
        <nav aria-label="Main" className="max-h-[calc(100dvh-5rem)] overflow-y-auto bg-header px-4 py-3 md:hidden">
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
            <li className="border-t border-header-line pt-2">
              <a href="/sso/leave" className={cx(mobileLinkClasses(false), "gap-2")}>
                <ArrowLeft className="size-4" aria-hidden />
                Back to OnePortal
              </a>
            </li>
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
