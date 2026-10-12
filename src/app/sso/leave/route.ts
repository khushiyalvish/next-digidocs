import { redirect } from "next/navigation";
import { getConfig } from "@/lib/config";
import { endCurrentSession } from "@/features/auth/session";

/**
 * GET /sso/leave — "Back to OnePortal" (hub CHILD-APP-GUIDE.md §5.6, §7.1). Ends this browser's
 * DigiDocs session, then opens the hub, where "Sign out" is. DigiDocs has no sign-out of its own
 * and no signed-out page (§10).
 *
 * A GET on purpose, so it is a plain link: a planted link can only end the person's DigiDocs
 * session, and the next page they open signs them in again through the hub. Link to it with
 * <a href="/sso/leave">, never <Link>: a prefetch would end the session.
 */
export async function GET() {
  await endCurrentSession(); // nothing of this person stays behind on this browser
  redirect(getConfig().onePortal.url);
}
