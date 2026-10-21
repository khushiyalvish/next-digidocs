// Suite kit v7: adapted from OnePortal tests/ui/responsive.spec.ts (this app's pages, sign-in through OnePortal). Merge hub changes by hand.
import { expect, test, type Page } from "@playwright/test";

/*
 * Pins the screen-size rules (docs/ARCHITECTURE.md §0.9) on every page, at every width from a
 * small phone to a wide monitor:
 *   1. the page never scrolls sideways;
 *   2. on phones, no text input is smaller than 16px (iOS Safari zooms into those);
 *   3. buttons and form controls are at least 36px tall on phones and 24px elsewhere
 *      (WCAG 2.2 target size). Checkboxes/radios are exempt: their whole label is the target.
 */

const WIDTHS = [320, 375, 414, 768, 1024, 1440, 2560];
const PHONE_MAX_WIDTH = 639; // below Tailwind's `sm`

// Every page of DigiDocs. Add each new page here.
const SIGNED_OUT_PAGES = ["/sso/error"];
// The test person is an LFZ Admin; Enterprise-only pages (/imports/new, /exports/new) and
// Account-only reports need a test person with that role. A record's pages (/imports/<id>,
// /exports/<id> and their /edit) need a record: none can be created before Add Import / Add Export.
const SIGNED_IN_PAGES = [
  "/",
  "/reports",
  "/reports/operations",
  "/reports/amendments",
  "/imports",
  "/imports?step=pending-lfz",
  "/exports",
  "/exports?status=completed",
  "/master/agents",
  "/master/agents?q=lim",
  "/master/agents/new",
  "/master/ports",
  "/master/ports?kind=air",
  "/master/banks",
  "/admin/users",
  "/admin/organisations",
  "/admin/organisations/new",
  "/admin/reference",
  "/admin/reference?q=0101",
];

async function expectResponsive(page: Page, width: number) {
  const sidewaysScroll = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sidewaysScroll, `page scrolls sideways by ${sidewaysScroll}px`).toBeLessThanOrEqual(0);

  const isPhone = width <= PHONE_MAX_WIDTH;

  if (isPhone) {
    const smallInputs = await page.$$eval(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), select, textarea',
      (elements) =>
        elements
          .filter((element) => element.getBoundingClientRect().width > 2)
          .filter((element) => parseFloat(getComputedStyle(element).fontSize) < 16)
          .map((element) => element.getAttribute("name") ?? element.outerHTML.slice(0, 80)),
    );
    expect(smallInputs, "inputs under 16px make iOS zoom").toEqual([]);
  }

  const minimumHeight = isPhone ? 36 : 24;
  const smallTargets = await page.$$eval(
    'button, input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), select',
    (elements, minimum) =>
      elements
        .map((element) => ({ element, box: element.getBoundingClientRect() }))
        .filter(({ box }) => box.width > 2 && box.height > 2) // visible, not screen-reader-only
        .filter(({ box }) => box.height < minimum)
        .map(({ element, box }) => `${element.textContent?.trim() || element.getAttribute("aria-label") || element.tagName} (${Math.round(box.height)}px)`),
    minimumHeight,
  );
  expect(smallTargets, `controls under ${minimumHeight}px`).toEqual([]);
}

async function checkAllWidths(page: Page, path: string) {
  for (const width of WIDTHS) {
    await test.step(`${width}px`, async () => {
      await page.setViewportSize({ width, height: width <= PHONE_MAX_WIDTH ? 800 : 1000 });
      await page.goto(path);
      await expectResponsive(page, width);
    });
  }
}

test.describe("signed-out pages", () => {
  for (const path of SIGNED_OUT_PAGES) {
    test(path, async ({ page }) => checkAllWidths(page, path));
  }
});

test.describe("signed-in pages", () => {
  test.skip(
    !process.env.UI_BASE_URL || !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    "Needs DigiDocs and OnePortal running with their databases: set UI_BASE_URL, E2E_EMAIL and E2E_PASSWORD (a hub user with access to DigiDocs).",
  );

  // DigiDocs has no login page: opening it sends the browser through OnePortal, whose login
  // page signs the person in and brings them back here (hub CHILD-APP-GUIDE.md §9).
  test.beforeEach(async ({ page, baseURL }) => {
    const app = new URL(baseURL!);
    await page.goto("/");
    await page.waitForURL((url) => url.origin !== app.origin);
    await page.getByLabel("Email").fill(process.env.E2E_EMAIL!);
    await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => url.origin === app.origin && url.pathname === "/");
  });

  for (const path of SIGNED_IN_PAGES) {
    test(path, async ({ page }) => checkAllWidths(page, path));
  }
});
