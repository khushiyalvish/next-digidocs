// Suite kit v7: copied from OnePortal src/themes/classic.ts. Change it in the hub first, then copy it here.
import { defineTheme } from "@/themes/theme";

/*
 * Classic: the suite's original look. Monochrome (Tailwind's zinc scale) with a single dark
 * primary; colour only carries meaning. The values are Tailwind's own, so this theme renders
 * exactly as the hand-written zinc classes did.
 *
 * To make a new theme: copy this file (or lagos.ts) to src/themes/<key>.ts, change `key`,
 * `label`, `description` and the values, then add it to THEMES in src/themes/index.ts.
 */
export const classic = defineTheme({
  key: "classic",
  label: "Classic",
  description: "Monochrome greys with a dark primary. Calm and neutral.",
  font: "geist",
  colors: {
    canvas: "oklch(98.5% 0 0)", // zinc-50
    surface: "#ffffff",
    subtle: "oklch(96.7% 0.001 286.375)", // zinc-100

    line: "oklch(92% 0.004 286.32)", // zinc-200
    lineSoft: "oklch(96.7% 0.001 286.375)", // zinc-100
    lineStrong: "oklch(87.1% 0.006 286.286)", // zinc-300

    ink: "oklch(21% 0.006 285.885)", // zinc-900
    inkSoft: "oklch(37% 0.013 285.805)", // zinc-700
    muted: "oklch(55.2% 0.016 285.938)", // zinc-500
    faint: "oklch(70.5% 0.015 286.067)", // zinc-400

    primary: "oklch(21% 0.006 285.885)", // zinc-900
    primaryHover: "oklch(27.4% 0.006 286.033)", // zinc-800
    onPrimary: "#ffffff",
    accent: "oklch(21% 0.006 285.885)", // zinc-900
    mark: "oklch(21% 0.006 285.885)", // zinc-900
    onMark: "#ffffff",

    header: "#ffffff",
    headerInk: "oklch(21% 0.006 285.885)", // zinc-900
    headerMuted: "oklch(55.2% 0.016 285.938)", // zinc-500
    headerHover: "oklch(96.7% 0.001 286.375)", // zinc-100
    headerLine: "oklch(92% 0.004 286.32)", // zinc-200

    // The one place Classic uses hue: a chart's series must be told apart.
    chart1: "#2a78d6",
    chart2: "#eb6834",
    chart3: "#1baf7a",

    success: "oklch(50.8% 0.118 165.612)", // emerald-700
    successSoft: "oklch(97.9% 0.021 166.113)", // emerald-50
    successLine: "oklch(90.5% 0.093 164.15)", // emerald-200
    warning: "oklch(47.3% 0.137 46.201)", // amber-800
    warningSoft: "oklch(98.7% 0.022 95.277)", // amber-50
    warningLine: "oklch(92.4% 0.12 95.746)", // amber-200
    danger: "oklch(50.5% 0.213 27.518)", // red-700
    dangerSoft: "oklch(97.1% 0.013 17.38)", // red-50
    dangerLine: "oklch(88.5% 0.062 18.334)", // red-200
  },
  radius: {
    button: "0.375rem",
    field: "0.375rem",
    card: "0.75rem",
  },
});
