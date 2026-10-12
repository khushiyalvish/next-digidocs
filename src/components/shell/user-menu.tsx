// Suite kit v7: adapted from OnePortal src/components/shell/user-menu.tsx (its two items, no "Sign out"). Merge hub changes by hand.
"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";

/**
 * The avatar button at the top right: who is signed in, their OnePortal account (password,
 * sessions, theme and signing out live in the hub), and the way back to OnePortal. There is no
 * "Sign out" here (hub CHILD-APP-GUIDE.md §7.1, §10).
 */
export function UserMenu({ fullName, email, hubAccountUrl }: { fullName: string; email: string; hubAccountUrl: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex min-h-10 items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm sm:min-h-0 text-header-ink transition-colors hover:bg-header-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-header-ink/30"
      >
        <Avatar name={fullName} size="sm" tone="mark" />
        <span className="hidden max-w-40 truncate font-medium sm:block">{fullName}</span>
        <ChevronDown className="size-3.5 text-header-muted" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[min(16rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-lg border border-line bg-surface shadow-lg shadow-ink/5"
        >
          <div className="border-b border-line-soft px-3.5 py-3">
            <p className="truncate text-sm font-medium text-ink">{fullName}</p>
            <p className="truncate text-[0.8125rem] text-muted">{email}</p>
          </div>
          <div className="p-1">
            <a
              href={hubAccountUrl}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm text-ink-soft hover:bg-subtle hover:text-ink sm:py-2"
            >
              <UserRound className="size-4 text-faint" aria-hidden />
              OnePortal account
            </a>
            {/* A plain <a>, never <Link>: a prefetch would end the session (/sso/leave). */}
            <a
              href="/sso/leave"
              role="menuitem"
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm text-ink-soft hover:bg-subtle hover:text-ink sm:py-2"
            >
              <ArrowLeft className="size-4 text-faint" aria-hidden />
              Back to OnePortal
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
