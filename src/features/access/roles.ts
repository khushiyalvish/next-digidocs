/*
 * The roles of DigiDocs (old DigiDocs: M_Role). A fixed list: what each role may do is decided in
 * code, so a role table would add nothing (ARCHITECTURE.md §0.2). The keys are stored in
 * user_accounts.role_key; database/migrations/0002_access.sql has a CHECK with the same keys.
 *
 * Pure: no database, no session. Never decides access by itself — guards do (guards.ts).
 */

export const ROLE_KEYS = ["lfz_admin", "enterprise", "nepza", "nis", "account"] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export interface RoleInfo {
  key: RoleKey;
  label: string;
  description: string;
  /** An Enterprise user acts for one organisation; every other role works across them. */
  needsOrganisation: boolean;
}

export const ROLES: Record<RoleKey, RoleInfo> = {
  lfz_admin: {
    key: "lfz_admin",
    label: "LFZ Admin",
    description: "Lagos Free Zone staff: reviews submissions, manages organisations and users.",
    needsOrganisation: false,
  },
  enterprise: {
    key: "enterprise",
    label: "Enterprise User",
    description: "Prepares and submits imports and exports for their organisation.",
    needsOrganisation: true,
  },
  nepza: {
    key: "nepza",
    label: "NEPZA User",
    description: "Nigeria Export Processing Zones Authority: approves or rejects submissions.",
    needsOrganisation: false,
  },
  nis: {
    key: "nis",
    label: "NIS User",
    // Old DigiDocs gave this role no screens; what it sees is decided with the Import module.
    description: "Nigeria Immigration Service.",
    needsOrganisation: false,
  },
  account: {
    key: "account",
    label: "Account",
    description: "Finance: final invoices and revenue.",
    needsOrganisation: false,
  },
};

export function roleLabel(role: RoleKey | null): string {
  return role ? ROLES[role].label : "No access yet";
}
