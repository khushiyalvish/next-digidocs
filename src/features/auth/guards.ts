// Suite kit v7: adapted from OnePortal src/features/auth/guards.ts (sign-in through OnePortal; DigiDocs roles). Merge hub changes by hand.
import "server-only";
import { notFound, redirect } from "next/navigation";
import { menuItem } from "@/features/access/menu";
import type { RoleKey } from "@/features/access/roles";
import { getCurrentSession, type SessionUser } from "@/features/auth/session";

/**
 * Guards: the first line of every page, server action and route handler that needs a person
 * (ARCHITECTURE.md §6). They return the typed caller; the acting user's id, role and
 * organisation always come from here, never from input.
 *
 * A refusal redirects or answers 404; they never return null. DigiDocs has no login page: a
 * signed-out person goes through OnePortal (/sso/login). Where they were going is remembered by
 * src/proxy.ts.
 */

/** Signed in, whatever their role. Only for pages that must work without one (/no-access, the shell). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentSession();
  if (!user) redirect("/sso/login");
  return user;
}

/** A signed-in person with a role. */
export type Member = SessionUser & { role: RoleKey };

/** Signed in AND given a role by an administrator. Without one: the "waiting for access" page. */
export async function requireMember(): Promise<Member> {
  const user = await requireUser();
  if (!user.role) redirect("/no-access");
  return user as Member;
}

/**
 * A member with one of these roles. Anyone else gets 404, not "forbidden": pages they may not
 * use are not advertised (as in the hub).
 */
export async function requireRole(...roles: RoleKey[]): Promise<Member> {
  const member = await requireMember();
  if (!roles.includes(member.role)) notFound();
  return member;
}

/**
 * A member whose role the menu gives this page (src/features/access/menu.ts). Pages listed in the
 * menu use this instead of naming roles themselves, so a page and its menu entry cannot disagree.
 */
export async function requireMenuItem(href: string): Promise<Member> {
  const item = menuItem(href);
  if (!item) throw new Error(`${href} is not in the menu (src/features/access/menu.ts).`);
  return requireRole(...item.roles);
}
