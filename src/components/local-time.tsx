// Suite kit v7: copied from OnePortal src/components/local-time.tsx. Change it in the hub first, then copy it here.
"use client";

/**
 * Shows an instant in the VIEWER's time zone and locale. The server renders in its own zone
 * first; the browser corrects it on hydration (hence suppressHydrationWarning).
 */
export function LocalTime({ value, relative = false }: { value: string | null; relative?: boolean }) {
  if (!value) return <span className="text-faint">—</span>;
  const date = new Date(value);
  const absolute = date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  return (
    <time dateTime={value} title={absolute} suppressHydrationWarning>
      {relative ? describeRelative(date) : absolute}
    </time>
  );
}

function describeRelative(date: Date): string {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
