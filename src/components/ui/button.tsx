// Suite kit v7: copied from OnePortal src/components/ui/button.tsx. Change it in the hub first, then copy it here.
import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/components/ui/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary shadow-xs hover:bg-primary-hover",
  secondary: "border border-line bg-surface text-ink shadow-xs hover:bg-canvas",
  ghost: "text-ink-soft hover:bg-subtle hover:text-ink",
  danger: "border border-danger-line bg-surface text-danger shadow-xs hover:bg-danger-soft",
};

// Taller on phones (touch), compact from the `sm` breakpoint up — see ARCHITECTURE.md §0.9.
const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[0.8125rem] sm:h-8",
  md: "h-10 px-4 text-sm sm:h-9 sm:px-3.5",
  lg: "h-11 w-full px-4 text-sm sm:h-10",
};

/** Button styling, also used to make a <Link> look like a button. */
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cx(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-button font-medium whitespace-nowrap transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-offset-1",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}
