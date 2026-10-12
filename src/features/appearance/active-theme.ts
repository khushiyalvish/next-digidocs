import "server-only";
import { cookies } from "next/headers";
import { findTheme, type Theme } from "@/themes";
import { THEME_COOKIE } from "@/features/auth/oneportal";

/**
 * The theme for this request, used by the kit's root layout (hub CHILD-APP-GUIDE.md §7.3): the
 * one OnePortal sent at the last sign-in in this browser. Anything missing or unknown falls back
 * to the kit's default. The cookie only chooses colours: editing it changes nothing else.
 */
export async function getActiveTheme(): Promise<Theme> {
  return findTheme((await cookies()).get(THEME_COOKIE)?.value);
}
