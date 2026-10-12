// Suite kit v7: copied from OnePortal src/themes/index.ts. Change it in the hub first, then copy it here.
import type { CSSProperties } from "react";
import { classic } from "@/themes/classic";
import { lagos } from "@/themes/lagos";
import type { Theme, ThemeColors, ThemeFont } from "@/themes/theme";

/*
 * Every theme the suite knows. Suite kit: the hub and every suite application have the same
 * list, so a theme chosen in the hub exists in each application (CHILD-APP-GUIDE.md §7.3).
 *
 * Adding a theme: create src/themes/<key>.ts (copy classic.ts or lagos.ts) and add it here.
 * Which themes people may use is decided by an administrator in the hub, not here.
 */
export const THEMES = [classic, lagos] as const satisfies readonly Theme[];

export type ThemeKey = (typeof THEMES)[number]["key"];

/** Used when nothing else applies: no choice yet, an unknown key, or settings that cannot be read. */
export const FALLBACK_THEME: Theme = classic;

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === "string" && THEMES.some((theme) => theme.key === value);
}

/** The theme with this key, or the fallback for anything unknown (a removed theme, a stale cookie). */
export function findTheme(key: string | null | undefined): Theme {
  return THEMES.find((theme) => theme.key === key) ?? FALLBACK_THEME;
}

// The CSS variable each font is loaded into (src/themes/fonts.ts), with system fallbacks.
const FONT_STACKS: Record<ThemeFont, string> = {
  geist: 'var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  ubuntu: 'var(--font-ubuntu), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

function cssName(token: string): string {
  return token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * The theme as CSS variables, for the `style` of <html>. src/app/globals.css turns each
 * `--theme-*` variable into a Tailwind token (`--theme-line-soft` → `border-line-soft`).
 */
export function themeStyle(theme: Theme): CSSProperties {
  const variables: Record<string, string> = {
    colorScheme: "light",
    "--theme-font-sans": FONT_STACKS[theme.font],
    "--theme-radius-button": theme.radius.button,
    "--theme-radius-field": theme.radius.field,
    "--theme-radius-card": theme.radius.card,
  };
  for (const [token, value] of Object.entries(theme.colors) as [keyof ThemeColors, string][]) {
    variables[`--theme-${cssName(token)}`] = value;
  }
  return variables as CSSProperties;
}

export type { Theme, ThemeColors } from "@/themes/theme";
