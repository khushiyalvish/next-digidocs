// Suite kit v7: copied from OnePortal src/components/shell/brand.tsx. Change it in the hub first, then copy it here.
import { LayoutGrid } from "lucide-react";
import { cx } from "@/components/ui/cx";

/**
 * The application's mark and name. One definition, used in the top bar and on the sign-in
 * pages. `onHeader` colours the name for the top bar, which a theme may make dark; `onPrimary`
 * is for a hero panel in the primary colour (the mark is inverted there, so it never vanishes).
 */
export function Brand({
  name,
  size = "md",
  onHeader = false,
  onPrimary = false,
}: {
  name: string;
  size?: "md" | "lg";
  onHeader?: boolean;
  onPrimary?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        className={cx(
          "flex shrink-0 items-center justify-center rounded-lg shadow-sm",
          onPrimary ? "bg-on-primary text-primary" : "bg-mark text-on-mark",
          size === "lg" ? "size-10" : "size-7",
        )}
      >
        <LayoutGrid className={size === "lg" ? "size-5" : "size-4"} aria-hidden />
      </span>
      <span
        className={cx(
          "truncate font-semibold tracking-tight",
          onPrimary ? "text-on-primary" : onHeader ? "text-header-ink" : "text-ink",
          size === "lg" ? "text-xl" : "text-[0.9375rem]",
        )}
      >
        {name}
      </span>
    </span>
  );
}
