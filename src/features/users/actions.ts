"use server";

import { refresh } from "next/cache";
import { withTransaction } from "@/lib/db";
import { getRequestInfo } from "@/lib/request-info";
import { done, fail, invalidInput, notFound, type ActionResult } from "@/lib/result";
import { formToObject } from "@/lib/schemas";
import { roleLabel } from "@/features/access/roles";
import { recordAudit } from "@/features/audit/record";
import { requireRole } from "@/features/auth/guards";
import { revokeAllSessions } from "@/features/auth/session";
import { getOrganisation } from "@/features/organisations/queries";
import { getUserForAdmin, type UserDetailDto } from "@/features/users/queries";
import { userAccessSchema, type UserAccess } from "@/features/users/schemas";
import { setUserAccess } from "@/features/users/writes";

/*
 * Administration of people. Every action: requireRole("lfz_admin") → parse → act → audit.
 * People are never created here: they appear at their first sign-in through OnePortal.
 */

export async function saveUserAccess(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("lfz_admin");
  const parsed = userAccessSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  const { userId, ...fields } = parsed.data;
  const { ipAddress } = await getRequestInfo();

  // Protects against locking DigiDocs out of administration by accident.
  if (userId === admin.id && (fields.role !== "lfz_admin" || !fields.isActive)) {
    return fail("You cannot change your own role or deactivate your own account.", "invalid_input");
  }

  const before = await getUserForAdmin(userId);
  if (!before) return notFound("User");

  if (fields.organisationId) {
    const organisation = await getOrganisation(fields.organisationId);
    if (!organisation) return fail("Choose an organisation from the list.", "invalid_input", { organisationId: "Not found" });
    if (!organisation.isActive && organisation.id !== before.organisationId) {
      return fail("This organisation is deactivated.", "invalid_input", { organisationId: "Deactivated organisation" });
    }
  }

  const saved = await withTransaction(async (tx) => {
    if (!(await setUserAccess(tx, userId, fields))) return false;
    // Deactivation takes effect at once: their sessions end now, not when they expire.
    if (before.isActive && !fields.isActive) await revokeAllSessions(tx, userId);
    const detail = describeChanges(before, fields);
    if (detail) {
      await recordAudit(tx, {
        eventType: "admin.user_access_changed",
        actor: { id: admin.id, email: admin.email },
        target: `${before.fullName} <${before.email}>`,
        detail,
        ipAddress,
      });
    }
    return true;
  });
  if (!saved) return notFound("User");

  refresh();
  return done("Changes saved.");
}

function describeChanges(before: UserDetailDto, after: Omit<UserAccess, "userId">): string | null {
  const changes = [
    before.role !== after.role ? `Role ${roleLabel(before.role)} → ${roleLabel(after.role)}` : null,
    before.organisationId !== after.organisationId ? "Organisation changed" : null,
    before.mobileNumber !== after.mobileNumber ? "Mobile number changed" : null,
    before.isActive !== after.isActive ? (after.isActive ? "Reactivated" : "Deactivated") : null,
  ].filter(Boolean);
  return changes.length ? changes.join(". ") : null;
}
