// Suite kit v7: copied from OnePortal src/app/layout.tsx. Change it in the hub first, then copy it here.
import type { Metadata, Viewport } from "next";
import { getConfig } from "@/lib/config";
import { themeStyle } from "@/themes";
import { fontVariables } from "@/themes/fonts";
import { getActiveTheme } from "@/features/appearance/active-theme";
import "./globals.css";

// Every page depends on who is signed in, so nothing is pre-rendered at build time. This also
// means `next build` needs no runtime settings (decision log, 2026-09-30).
export const dynamic = "force-dynamic";

// Pinch-zoom stays enabled (accessibility). Colours the mobile browser bar like the top bar.
export async function generateViewport(): Promise<Viewport> {
  const theme = await getActiveTheme();
  return { width: "device-width", initialScale: 1, themeColor: theme.colors.header };
}

export async function generateMetadata(): Promise<Metadata> {
  const { appName } = getConfig();
  return {
    title: { default: appName, template: `%s · ${appName}` },
    description: `${appName} — one sign-in for your work applications.`,
    robots: { index: false, follow: false },
  };
}

/** The active theme (src/themes) is applied here, on <html>, so it reaches every page. */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await getActiveTheme();
  return (
    <html lang="en" data-theme={theme.key} style={themeStyle(theme)} className={`${fontVariables} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
