import type { RoleKey } from "@/features/access/roles";

/*
 * The DigiDocs menu, per role: the sections of the top bar and the items of each section's
 * dropdown. It follows old DigiDocs's menus (Views/Shared/_LayoutFinal.cshtml, one block per role
 * id) and its labels. The one place that says who may open which page: guards.ts
 * `requireMenuItem` reads it, so a page and its menu entry cannot disagree.
 *
 * Pure: no database, no session.
 */

export interface MenuItem {
  href: string;
  label: string;
  roles: readonly RoleKey[];
  /** For a screen not built yet: the module that brings it (docs/PROGRESS.md §1a). */
  comingIn?: string;
  /** What the old screen did, shown on its "coming" page. */
  summary?: string;
}

export interface MenuSection {
  href: string;
  label: string;
  roles: readonly RoleKey[];
  /** The section's dropdown items. Empty: the section is a plain link. */
  items: MenuItem[];
}

const ALL_MEMBERS: RoleKey[] = ["lfz_admin", "enterprise", "nepza", "nis", "account"];

export const MENU: MenuSection[] = [
  { href: "/", label: "Home", roles: ALL_MEMBERS, items: [] },
  {
    // Old DigiDocs called its reports menu "Dashboard"; Home is the counts dashboard.
    href: "/reports",
    label: "Dashboard",
    roles: ["lfz_admin", "account"],
    items: [
      {
        href: "/reports",
        label: "Details Import/Export",
        roles: ["lfz_admin", "account"],
        comingIn: "module 8 (Reports)",
        summary: "Every import and export with its enterprise, transaction type, tracking and bill numbers, value, supplier and duty status, filtered by transaction type, month and year.",
      },
      {
        href: "/reports/operations",
        label: "Summary Of Operations",
        roles: ["lfz_admin"],
        comingIn: "module 8 (Reports)",
        summary: "Totals of operations per enterprise and transaction type.",
      },
      {
        href: "/reports/amendments",
        label: "Amendment History",
        roles: ["lfz_admin"],
        comingIn: "module 8 (Reports)",
        summary: "Submissions that were rejected and sent back for changes, with the reasons.",
      },
      {
        href: "/reports/final-invoices",
        label: "Final Invoices",
        roles: ["account"],
        comingIn: "module 8 (Reports)",
        summary: "The invoices generated for completed imports.",
      },
      {
        href: "/reports/revenue",
        label: "Orion Revenue",
        roles: ["account"],
        comingIn: "module 9 (Orion revenue)",
        summary: "Revenue per organisation, as sent to Orion.",
      },
      {
        href: "/reports/import-final",
        label: "Import Final View",
        roles: ["account"],
        comingIn: "module 8 (Reports)",
        summary: "Completed imports with their final figures.",
      },
      {
        href: "/reports/export-final",
        label: "Export Final View",
        roles: ["account"],
        comingIn: "module 8 (Reports)",
        summary: "Completed exports with their final figures.",
      },
    ],
  },
  {
    href: "/imports",
    label: "Import",
    roles: ["lfz_admin", "enterprise", "nepza", "account"],
    items: [
      {
        href: "/imports/new",
        label: "Add Import",
        roles: ["enterprise"],
        comingIn: "module 4 (Import)",
        summary: "An import with its key information, items (HSE codes), containers, invoices and the documents its transaction type requires.",
      },
      {
        href: "/imports",
        label: "List Import",
        roles: ["lfz_admin", "enterprise", "nepza", "account"],
      },
    ],
  },
  {
    href: "/exports",
    label: "Export",
    roles: ["lfz_admin", "enterprise", "nepza"],
    items: [
      {
        href: "/exports/new",
        label: "Add Export",
        roles: ["enterprise"],
        comingIn: "module 5 (Export)",
        summary: "An export with its key information (buyer, shipping mode, consignment, ports), HSE codes, items, tracking and documents.",
      },
      {
        href: "/exports",
        label: "List Export",
        roles: ["lfz_admin", "enterprise", "nepza"],
      },
    ],
  },
  {
    href: "/master",
    label: "Master",
    roles: ["lfz_admin"],
    items: [
      { href: "/master/agents/new", label: "Add Agent", roles: ["lfz_admin"] },
      { href: "/master/agents", label: "List Agent", roles: ["lfz_admin"] },
      { href: "/master/ports", label: "Ports", roles: ["lfz_admin"] },
      { href: "/master/banks", label: "Banks", roles: ["lfz_admin"] },
    ],
  },
  {
    href: "/admin",
    label: "Administration",
    roles: ["lfz_admin"],
    items: [
      { href: "/admin/users", label: "Users", roles: ["lfz_admin"] },
      { href: "/admin/organisations", label: "Organisations", roles: ["lfz_admin"] },
      { href: "/admin/reference", label: "Reference data", roles: ["lfz_admin"] },
    ],
  },
];

/** The top-bar sections a role sees, each with only the items that role may open. */
export function menuFor(role: RoleKey): MenuSection[] {
  return MENU.filter((section) => section.roles.includes(role)).map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  }));
}

/** The menu entry (section or item) for a page's address; an item wins over its section. */
export function menuItem(href: string): MenuItem | MenuSection | undefined {
  for (const section of MENU) {
    const item = section.items.find((each) => each.href === href);
    if (item) return item;
  }
  return MENU.find((section) => section.href === href);
}

/** One step of a page's breadcrumb. Without href: not a page (a menu section) or the page itself. */
export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Home › section › item for a page in the menu. A section is a dropdown, not a page, so it has
 * no link. Pages below an item (a record, "Add…") append their own crumb.
 */
export function menuTrail(href: string): Crumb[] {
  const home: Crumb = { label: "Home", href: "/" };
  if (href === "/") return [home];
  for (const section of MENU) {
    const item = section.items.find((each) => each.href === href);
    if (item) return [home, { label: section.label }, { label: item.label, href: item.href }];
  }
  const section = MENU.find((each) => each.href === href);
  return section ? [home, { label: section.label, href: section.href }] : [home];
}
