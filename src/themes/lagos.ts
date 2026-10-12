// Suite kit v7: copied from OnePortal src/themes/lagos.ts. Change it in the hub first, then copy it here.
import { defineTheme } from "@/themes/theme";

/*
 * Lagos Free Zone: the colour scheme of lagosfreezone.com.
 *
 *   #001f57  navy        the site's header and dark panels  → top bar, primary buttons
 *   #002c72  lighter navy                                    → primary hover
 *   #001a4f  heading navy the site's headings                → main text
 *   #479bc2  sky blue    the site's buttons and link hovers  → focus, current tab, chosen option
 *   #f51f00  red-orange  the site's badges and highlights    → the brand mark
 *   #e7ebf6  pale blue   the site's hover fills              → quiet fills
 *   Ubuntu               the site's typeface
 *
 * The site's sky-blue buttons carry white text at 3:1 contrast, below the 4.5:1 that WCAG
 * asks of text, so here buttons are navy and sky blue marks focus and selection instead.
 */
export const lagos = defineTheme({
  key: "lagos",
  label: "Lagos Free Zone",
  description: "Navy, sky blue and a red-orange mark, after lagosfreezone.com.",
  font: "ubuntu",
  colors: {
    canvas: "#f4f6fb",
    surface: "#ffffff",
    subtle: "#e7ebf6",

    line: "#dce2ee",
    lineSoft: "#edf0f7",
    lineStrong: "#c3cbdd",

    ink: "#001a4f",
    inkSoft: "#2c3a5a",
    muted: "#5a6683",
    faint: "#8e98b0",

    primary: "#001f57",
    primaryHover: "#002c72",
    onPrimary: "#ffffff",
    accent: "#479bc2",
    mark: "#f51f00",
    onMark: "#ffffff",

    header: "#001f57",
    headerInk: "#ffffff",
    headerMuted: "#b4c0da",
    headerHover: "#18407f",
    headerLine: "#001a4f",

    chart1: "#1f6fb5",
    chart2: "#eb6834",
    chart3: "#1baf7a",

    success: "#047857",
    successSoft: "#ecfdf5",
    successLine: "#a7f3d0",
    warning: "#92400e",
    warningSoft: "#fffbeb",
    warningLine: "#fde68a",
    danger: "#b91c1c",
    dangerSoft: "#fef2f2",
    dangerLine: "#fecaca",
  },
  radius: {
    button: "9999px",
    field: "0.5rem",
    card: "0.75rem",
  },
});
