// Suite kit v7: copied from OnePortal tests/unit/themes.test.ts. Change it in the hub first, then copy it here.
import { describe, expect, it } from "vitest";
import { FALLBACK_THEME, THEMES, findTheme, themeStyle, type ThemeColors } from "@/themes";

/*
 * Suite kit: the same file in the hub and in every suite application.
 *
 * Every theme file must be usable as it stands: a valid key, colours a browser understands,
 * and text that people can read (WCAG 2.2 AA: 4.5:1 for text). A new theme that fails here
 * is fixed in its file, not by loosening the check.
 */

// ---- Colour maths: hex and oklch() → relative luminance ----------------------------------

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Linear-light sRGB channels (0–1) of a "#rrggbb", "#rgb" or "oklch(L% C H)" colour. */
function linearRgb(color: string): [number, number, number] {
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join("") : hex[1];
    return [0, 2, 4].map((i) => srgbToLinear(parseInt(digits.slice(i, i + 2), 16) / 255)) as [number, number, number];
  }
  const oklch = color.match(/^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+|none)\s*\)$/);
  if (oklch) {
    const lightness = Number(oklch[1]) / 100;
    const chroma = Number(oklch[2]);
    const hue = oklch[3] === "none" ? 0 : (Number(oklch[3]) * Math.PI) / 180;
    const a = chroma * Math.cos(hue);
    const b = chroma * Math.sin(hue);
    // OKLab → linear sRGB (Björn Ottosson).
    const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    return [
      clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    ];
  }
  throw new Error(`Not a colour this check understands (use #rrggbb or oklch(L% C H)): ${color}`);
}

function contrast(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const [r, g, b] = linearRgb(color);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// Text the kit puts on a background: [text token, background token].
const TEXT_PAIRS: [keyof ThemeColors, keyof ThemeColors][] = [
  ["ink", "canvas"],
  ["ink", "surface"],
  ["inkSoft", "surface"],
  ["muted", "surface"],
  ["muted", "canvas"],
  ["onPrimary", "primary"],
  ["onPrimary", "primaryHover"],
  ["headerInk", "header"],
  ["headerInk", "headerHover"],
  ["headerMuted", "header"],
  ["success", "successSoft"],
  ["warning", "warningSoft"],
  ["danger", "dangerSoft"],
  ["danger", "surface"],
];

describe("theme files", () => {
  it("have unique, stable keys", () => {
    const keys = THEMES.map((theme) => theme.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z0-9-]{1,40}$/); // fits enabled_themes.theme_key
    expect(keys).toContain(FALLBACK_THEME.key);
  });

  for (const theme of THEMES) {
    describe(theme.label, () => {
      it("uses only colours the contrast check can read", () => {
        for (const value of Object.values(theme.colors)) expect(() => linearRgb(value)).not.toThrow();
      });

      for (const [text, background] of TEXT_PAIRS) {
        it(`${text} on ${background} is readable (≥ 4.5:1)`, () => {
          expect(contrast(theme.colors[text], theme.colors[background])).toBeGreaterThanOrEqual(4.5);
        });
      }

      it("shows the mark's icon and the focus ring clearly enough (≥ 3:1, WCAG non-text)", () => {
        expect(contrast(theme.colors.onMark, theme.colors.mark)).toBeGreaterThanOrEqual(3);
      });

      it("draws chart series that stand out from the card they sit on (≥ 3:1 for the first two)", () => {
        // The third series may be lighter: charts always carry a legend and a table as well.
        expect(contrast(theme.colors.chart1, theme.colors.surface)).toBeGreaterThanOrEqual(3);
        expect(contrast(theme.colors.chart2, theme.colors.surface)).toBeGreaterThanOrEqual(3);
        expect(contrast(theme.colors.chart3, theme.colors.surface)).toBeGreaterThanOrEqual(2.5);
        expect(new Set([theme.colors.chart1, theme.colors.chart2, theme.colors.chart3]).size).toBe(3);
      });

      it("becomes one CSS variable per token", () => {
        const style = themeStyle(theme) as Record<string, string>;
        expect(style["--theme-line-soft"]).toBe(theme.colors.lineSoft);
        expect(style["--theme-radius-button"]).toBe(theme.radius.button);
        expect(Object.keys(style).filter((name) => name.startsWith("--theme-")).length).toBe(
          Object.keys(theme.colors).length + 4, // + font and three radii
        );
      });
    });
  }

  it("falls back for an unknown or missing key", () => {
    expect(findTheme("no-such-theme")).toBe(FALLBACK_THEME);
    expect(findTheme(null)).toBe(FALLBACK_THEME);
    expect(findTheme("lagos").key).toBe("lagos");
  });
});
