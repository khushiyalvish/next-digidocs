// Suite kit v7: copied from OnePortal src/components/ui/cx.ts. Change it in the hub first, then copy it here.
/** Joins class names, skipping empty ones: cx("a", isOn && "b"). */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
