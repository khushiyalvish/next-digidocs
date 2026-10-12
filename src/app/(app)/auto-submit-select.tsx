"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";
import { cx } from "@/components/ui/cx";
import { controlHeight, inputClasses } from "@/components/ui/primitives";

/**
 * A <select> in a GET filter form that applies itself when changed (the LFZ dashboard has no
 * "Apply" button). Without JavaScript the form still works through its own submit button.
 */
export function AutoSubmitSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      {...props}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className={cx(inputClasses, controlHeight, "w-full pr-8", className)}
    >
      {children}
    </select>
  );
}
