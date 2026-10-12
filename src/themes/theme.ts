// Suite kit v7: copied from OnePortal src/themes/theme.ts. Change it in the hub first, then copy it here.
/*
 * What a theme is. Every theme file (src/themes/<key>.ts) fills in ALL of these; TypeScript
 * refuses a theme that leaves one out, so a new theme can never render half-styled.
 *
 * Components never use raw palette classes (zinc-900, red-600…). They use the token names
 * below as Tailwind classes — `bg-surface`, `text-ink`, `border-line`, `bg-primary`,
 * `ring-accent/25`, `rounded-card` — and src/app/globals.css maps each class to the active
 * theme's value. Colours are any CSS colour (hex, rgb(), oklch()).
 */

export interface ThemeColors {
  // Surfaces
  /** Page background behind everything. */
  canvas: string;
  /** Cards, tables, inputs, menus. */
  surface: string;
  /** Quiet fills: hover backgrounds, neutral badges, icon wells. */
  subtle: string;

  // Lines
  /** Borders of cards, tables, menus. */
  line: string;
  /** Dividers inside a card or table. */
  lineSoft: string;
  /** Input borders, dashed outlines. */
  lineStrong: string;

  // Text
  /** Headings and main text. */
  ink: string;
  /** Body text in tables and menus; form labels. */
  inkSoft: string;
  /** Secondary text: descriptions, hints, column headings. */
  muted: string;
  /** Icons, placeholders, decorative chevrons. Not for text that must be read. */
  faint: string;

  // Actions
  /** Primary buttons, avatars, text selection. */
  primary: string;
  primaryHover: string;
  /** Text and icons on `primary`. */
  onPrimary: string;
  /** Focus rings, the focused input's border, the current tab's underline, chosen options. */
  accent: string;
  /** The brand mark's tile (top bar, sign-in pages). */
  mark: string;
  /** The icon on `mark`. */
  onMark: string;

  // The top bar
  header: string;
  /** The application name and the current section on the top bar. */
  headerInk: string;
  /** Other sections and icons on the top bar. */
  headerMuted: string;
  /** Hover and current-section fill on the top bar. */
  headerHover: string;
  /** The top bar's bottom border. */
  headerLine: string;

  // Charts — series colours, in this fixed order (first series = chart1). Identity only: never
  // for state (that is success/warning/danger) and never for text. Each needs to stand out from
  // `surface` and from the other two, also for colour-blind readers (tests/unit/themes.test.ts).
  chart1: string;
  chart2: string;
  chart3: string;

  // Meaning — keep these recognisable in every theme: green = done, amber = careful, red = wrong.
  success: string;
  successSoft: string;
  successLine: string;
  warning: string;
  warningSoft: string;
  warningLine: string;
  danger: string;
  dangerSoft: string;
  dangerLine: string;
}

export interface ThemeRadius {
  /** Buttons. "9999px" makes pills. */
  button: string;
  /** Inputs and copyable fields. */
  field: string;
  /** Cards, tables, tiles, empty states. */
  card: string;
}

/** Fonts the kit loads (src/themes/fonts.ts). Add one there before using it here. */
export type ThemeFont = "geist" | "ubuntu";

export interface Theme {
  /** Stable id, stored in the database and sent to suite applications: lower-case, a–z 0–9 and -. Never rename. */
  key: string;
  /** Shown to administrators and people choosing a theme. */
  label: string;
  /** One line under the label. */
  description: string;
  font: ThemeFont;
  colors: ThemeColors;
  radius: ThemeRadius;
}

/** Identity function that makes TypeScript check a theme file against `Theme`. */
export function defineTheme<const T extends Theme>(theme: T): T {
  return theme;
}
