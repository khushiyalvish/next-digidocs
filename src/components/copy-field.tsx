// Suite kit v7: copied from OnePortal src/components/copy-field.tsx. Change it in the hub first, then copy it here.
"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cx } from "@/components/ui/cx";

/** A read-only value with a copy button — for app ids, secrets and URLs. */
export function CopyField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium text-ink">{label}</div>
      <div className="flex items-stretch overflow-hidden rounded-field border border-line-strong bg-canvas shadow-xs">
        <code
          className={cx(
            // Wraps instead of truncating, so the whole value can be checked on a phone.
            "min-w-0 flex-1 px-3 py-2 font-mono text-[0.8125rem] break-all text-ink select-all",
            secret && "tracking-tight",
          )}
        >
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className="flex min-h-10 shrink-0 items-center gap-1.5 border-l border-line-strong bg-surface px-3 text-[0.8125rem] sm:min-h-0 font-medium text-ink-soft hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/20"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
