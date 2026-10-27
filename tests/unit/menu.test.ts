import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MENU, menuFor, menuItem, menuTrail } from "@/features/access/menu";
import { ROLE_KEYS } from "@/features/access/roles";
import { dashboardFilterSchema } from "@/features/dashboard/schemas";
import { DASHBOARD_CARDS } from "@/features/dashboard/steps";

/* Pins the menu (features/access/menu.ts) and the dashboard's pure rules (features/dashboard). */

const page = (href: string) => join(process.cwd(), "src", "app", "(app)", ...href.split("/").filter(Boolean), "page.tsx");

describe("menu", () => {
  it("has a page for every section and item", () => {
    for (const section of MENU) {
      expect(existsSync(page(section.href)), section.href).toBe(true);
      for (const item of section.items) expect(existsSync(page(item.href)), item.href).toBe(true);
    }
  });

  it("never gives an item to a role its section does not show", () => {
    for (const section of MENU) {
      for (const item of section.items) {
        for (const role of item.roles) expect(section.roles, `${item.href} → ${role}`).toContain(role);
      }
    }
  });

  it("gives every role Home, and Master and Administration only to LFZ Admins", () => {
    for (const role of ROLE_KEYS) {
      const hrefs = menuFor(role).map((section) => section.href);
      expect(hrefs[0]).toBe("/");
      expect(hrefs.includes("/admin") || hrefs.includes("/master")).toBe(role === "lfz_admin");
    }
  });

  it("follows old DigiDocs's menus and labels", () => {
    expect(menuFor("lfz_admin").map((section) => section.label)).toEqual(["Home", "Dashboard", "Import", "Export", "Master", "Administration"]);
    const items = (role: (typeof ROLE_KEYS)[number], href: string) =>
      menuFor(role)
        .find((section) => section.href === href)
        ?.items.map((item) => item.label);
    expect(items("lfz_admin", "/master")).toEqual(["Add Agent", "List Agent", "Ports", "Banks"]);
    expect(items("lfz_admin", "/reports")).toEqual(["Details Import/Export", "Summary Of Operations", "Amendment History"]);
    expect(items("enterprise", "/imports")).toEqual(["Add Import", "List Import"]);
    expect(items("lfz_admin", "/imports")).toEqual(["List Import"]);
    expect(menuFor("nis").map((section) => section.label)).toEqual(["Home"]);
  });

  it("finds an entry by its address, the item before its section", () => {
    expect(menuItem("/master/ports")?.label).toBe("Ports");
    expect(menuItem("/reports")?.label).toBe("Details Import/Export");
    expect(menuItem("/master")?.label).toBe("Master");
    expect(menuItem("/nowhere")).toBeUndefined();
  });
});

describe("dashboard", () => {
  it("opens the import list at the five steps of the LFZ design and the enterprise's saved imports", () => {
    expect(DASHBOARD_CARDS.map((card) => card.label)).toEqual([
      "Total Count",
      "Saved Transactions",
      "Pending from LFZ",
      "Pending from NEPZA",
      "Approval pending from LFTZ",
      "Process Completed",
    ]);
  });

  it("reads its address-bar choices, ignoring anything malformed", () => {
    expect(dashboardFilterSchema.parse({ type: "nope", enterprise: "x", range: "12", sample: "yes" })).toEqual({ range: 30, sample: false });
    const id = "0A000000-0000-4000-8000-000000000001";
    expect(dashboardFilterSchema.parse({ type: id, range: "90", sample: "1" })).toEqual({ type: id.toLowerCase(), range: 90, sample: true });
  });
});

describe("breadcrumbs (menuTrail)", () => {
  it("is Home › section › item, the section without a link (it is a dropdown)", () => {
    expect(menuTrail("/")).toEqual([{ label: "Home", href: "/" }]);
    expect(menuTrail("/master/agents")).toEqual([
      { label: "Home", href: "/" },
      { label: "Master" },
      { label: "List Agent", href: "/master/agents" },
    ]);
    expect(menuTrail("/imports").map((crumb) => crumb.label)).toEqual(["Home", "Import", "List Import"]);
    expect(menuTrail("/nowhere")).toEqual([{ label: "Home", href: "/" }]);
  });

  it("has a trail for every menu item", () => {
    for (const section of MENU) for (const item of section.items) expect(menuTrail(item.href).at(-1)?.label, item.href).toBe(item.label);
  });
});
