// Suite kit v7: copied from OnePortal src/themes/fonts.ts. Change it in the hub first, then copy it here.
import { Geist, Geist_Mono, Ubuntu } from "next/font/google";

/*
 * Every font a theme may use (ThemeFont in src/themes/theme.ts). next/font downloads them at
 * build time and serves them from this application, so the page never calls Google.
 * Each one is only a CSS variable until a theme points --theme-font-sans at it.
 */
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Ubuntu is not a variable font: only the weights the kit uses (regular, medium, bold).
const ubuntu = Ubuntu({ variable: "--font-ubuntu", subsets: ["latin"], weight: ["400", "500", "700"] });

/** Put on <html> so every theme's font is available. */
export const fontVariables = [geistSans.variable, geistMono.variable, ubuntu.variable].join(" ");
