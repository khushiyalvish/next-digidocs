// Suite kit v7: adapted from OnePortal playwright.config.ts (signed-out page, OnePortal placeholders). Merge hub changes by hand.
import { defineConfig } from "@playwright/test";

/**
 * UI checks (`npm run test:ui`): every page at every screen width — see tests/ui/responsive.spec.ts.
 *
 * Uses the Microsoft Edge already installed on the machine (no browser download). Set
 * UI_BROWSER_CHANNEL=chrome to use Google Chrome instead.
 *
 * Two modes:
 *  - Default: starts the production build (`npm run build` first) on port 3200 with placeholder
 *    settings and NO database and no hub. Only signed-out pages can be checked this way.
 *  - UI_BASE_URL=http://localhost:3008 (DigiDocs running with a database, signed in through a
 *    running OnePortal) plus E2E_EMAIL and E2E_PASSWORD of a hub user with access to DigiDocs:
 *    signed-in pages are checked too.
 */
const port = 3200;
const baseURL = process.env.UI_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/ui",
  fullyParallel: true,
  reporter: [["list"]],
  timeout: 120_000,
  use: {
    baseURL,
    channel: process.env.UI_BROWSER_CHANNEL ?? "msedge",
  },
  webServer: process.env.UI_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${port}`,
        url: `${baseURL}/sso/error`,
        timeout: 60_000,
        reuseExistingServer: false,
        // Placeholders: enough for the server to start and render signed-out pages. The
        // database and hub addresses are deliberately unreachable.
        env: {
          DATABASE_CONNECTION_STRING: "Server=localhost,1;Database=ui_checks_no_database;User Id=none;Password=none",
          // PORT too: a developer's .env.local may set another one, and the app refuses an
          // APP_URL whose port differs from PORT.
          PORT: String(port),
          APP_URL: `https://localhost:${port}`,
          ONEPORTAL_URL: "http://localhost:1",
          ONEPORTAL_APP_ID: "00000000-0000-4000-8000-000000000000",
          ONEPORTAL_APP_SECRET: "ui-checks-placeholder-secret-0123456789abcdef",
        },
      },
});
