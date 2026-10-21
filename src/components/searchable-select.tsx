"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { controlHeight, inputClasses } from "@/components/ui/primitives";

/*
 * A dropdown with a search box (decision log 2026-10-15: DigiDocs content for now, not suite kit;
 * to move into the hub's kit if other applications want it, PROGRESS.md open item). Two ways to
 * get its choices:
 *   options  a list the page already has; the search filters it in the browser;
 *   load     a function asked for each search (e.g. GET /api/hse-codes), for lists too long to send.
 * The chosen id is posted as a hidden input named `name`. Uncontrolled (`defaultValue`) or
 * controlled (`value` + `onChange`). The list opens in a layer above the page, so a table that
 * scrolls sideways never cuts it off. Keyboard: arrows, Enter, Escape.
 */

export interface SelectOption<T = unknown> {
  id: string;
  label: string;
  /** A second, smaller line, e.g. an HSE code's description. */
  detail?: string | null;
  data?: T;
}

export function SearchableSelect<T = unknown>({
  name,
  options,
  load,
  value,
  defaultValue,
  selected,
  onChange,
  placeholder = "-- Select --",
  label,
  id,
  invalid,
  clearable = true,
  className,
}: {
  name?: string;
  options?: SelectOption<T>[];
  load?: (query: string, signal: AbortSignal) => Promise<SelectOption<T>[]>;
  /** Controlled: the chosen id ("" for none). */
  value?: string;
  defaultValue?: string;
  /** With `load`: the chosen option, which is not in any list yet. */
  selected?: SelectOption<T> | null;
  onChange?: (option: SelectOption<T> | null) => void;
  placeholder?: string;
  /** The accessible name, when no <label htmlFor> points at `id`. */
  label?: string;
  id?: string;
  invalid?: boolean;
  clearable?: boolean;
  className?: string;
}) {
  const [ownValue, setOwnValue] = useState(defaultValue ?? "");
  const current = value ?? ownValue;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState<SelectOption<T>[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const chosen = selected && selected.id === current ? selected : (options ?? loaded).find((option) => option.id === current) ?? null;
  const needle = query.trim().toLowerCase();
  const shown = load
    ? loaded
    : (options ?? []).filter((option) => !needle || option.label.toLowerCase().includes(needle) || option.detail?.toLowerCase().includes(needle));

  function choose(option: SelectOption<T> | null) {
    if (value === undefined) setOwnValue(option?.id ?? "");
    onChange?.(option);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  // Asks `load` for each search, a moment after the last keystroke.
  useEffect(() => {
    if (!open || !load) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setLoaded(await load(query, controller.signal));
        setActive(0);
      } catch {
        // Aborted by the next keystroke, or offline: keep the last results.
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, load]);

  // Places the layer under the field (above it when there is no room below), and follows scrolling.
  useLayoutEffect(() => {
    if (!open) return;
    function measure() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 256), window.innerWidth - 16);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const below = window.innerHeight - rect.bottom;
      setPlace(below >= 300 || below >= rect.top ? { left, width, top: rect.bottom + 4 } : { left, width, bottom: window.innerHeight - rect.top + 4 });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  // Closes on a click outside the field and its layer.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className={cx("relative min-w-0", className)}>
      {name && <input type="hidden" name={name} value={current} />}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label ? `${label}: ${chosen?.label ?? "none chosen"}` : undefined}
        onClick={() => {
          setOpen((now) => !now);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        title={chosen?.detail ?? chosen?.label}
        className={cx(
          inputClasses,
          controlHeight,
          "flex w-full items-center justify-between gap-2 pr-2 text-left",
          invalid && "border-danger",
        )}
      >
        <span className={cx("min-w-0 truncate", !chosen && "text-faint")}>{chosen?.label ?? placeholder}</span>
        <ChevronDown className={cx("size-4 shrink-0 text-faint transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open &&
        place &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", left: place.left, width: place.width, top: place.top, bottom: place.bottom }}
            className="z-50 overflow-hidden rounded-lg border border-line bg-surface shadow-lg shadow-ink/10"
          >
            <div className="relative border-b border-line-soft p-2">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-faint" aria-hidden />
              <input
                autoFocus
                type="text"
                role="combobox"
                aria-controls={listId}
                aria-expanded
                aria-autocomplete="list"
                aria-label={`Search ${label ?? "options"}`}
                aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActive((index) => Math.min(index + 1, shown.length - 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActive((index) => Math.max(index - 1, 0));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    if (shown[active]) choose(shown[active]);
                  } else if (event.key === "Escape") {
                    setOpen(false);
                    setQuery("");
                    triggerRef.current?.focus();
                  }
                }}
                placeholder="Type to search"
                autoComplete="off"
                className={cx(inputClasses, controlHeight, "pl-8")}
              />
            </div>
            <ul id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto p-1">
              {loading && shown.length === 0 && (
                <li className="flex items-center gap-2 px-2 py-2 text-[0.8125rem] text-muted">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden /> Searching…
                </li>
              )}
              {!loading && shown.length === 0 && <li className="px-2 py-2 text-[0.8125rem] text-muted">Nothing matches.</li>}
              {shown.map((option, index) => (
                <li
                  key={option.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={option.id === current}
                  onPointerEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                  className={cx(
                    "flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm",
                    index === active ? "bg-subtle text-ink" : "text-ink-soft",
                  )}
                >
                  <Check className={cx("mt-0.5 size-4 shrink-0 text-primary", option.id !== current && "invisible")} aria-hidden />
                  <span className="min-w-0">
                    <span className="block wrap-anywhere">{option.label}</span>
                    {option.detail && <span className="block truncate text-xs text-muted">{option.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {clearable && current && (
              <button
                type="button"
                onClick={() => choose(null)}
                className="flex w-full items-center gap-2 border-t border-line-soft px-3 py-2 text-left text-[0.8125rem] text-muted hover:bg-subtle hover:text-ink"
              >
                <X className="size-3.5" aria-hidden /> Clear the choice
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
