"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { withTransaction } from "@/lib/db";
import { getRequestInfo } from "@/lib/request-info";
import { done, invalidInput, notFound, type ActionResult } from "@/lib/result";
import { formToObject } from "@/lib/schemas";
import { recordAudit } from "@/features/audit/record";
import { requireRole } from "@/features/auth/guards";
import { getOrganisation } from "@/features/organisations/queries";
import { createOrganisationSchema, updateOrganisationSchema } from "@/features/organisations/schemas";
import { insertOrganisation, updateOrganisation } from "@/features/organisations/writes";

/*
 * Administration of organisations (the enterprises). Every action: requireRole("lfz_admin") →
 * parse → write → audit. Deactivating an organisation takes access from its people at their
 * next request (session.ts), without deleting anything.
 */

export async function createOrganisation(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("lfz_admin");
  const parsed = createOrganisationSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  const fields = parsed.data;
  const { ipAddress } = await getRequestInfo();

  const id = await withTransaction(async (tx) => {
    const created = await insertOrganisation(tx, fields);
    await recordAudit(tx, {
      eventType: "admin.organisation_created",
      actor: { id: admin.id, email: admin.email },
      target: `${fields.companyName} (${fields.shortCode})`,
      ipAddress,
    });
    return created;
  });

  redirect(`/admin/organisations/${id}?notice=created`);
}

export async function saveOrganisation(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("lfz_admin");
  const parsed = updateOrganisationSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  const { organisationId, ...fields } = parsed.data;
  const { ipAddress } = await getRequestInfo();

  const before = await getOrganisation(organisationId);
  if (!before) return notFound("Organisation");

  const saved = await withTransaction(async (tx) => {
    if (!(await updateOrganisation(tx, organisationId, fields))) return false;
    await recordAudit(tx, {
      eventType: "admin.organisation_updated",
      actor: { id: admin.id, email: admin.email },
      target: `${fields.companyName} (${fields.shortCode})`,
      detail: before.isActive !== fields.isActive ? (fields.isActive ? "Reactivated" : "Deactivated") : null,
      ipAddress,
    });
    return true;
  });
  if (!saved) return notFound("Organisation");

  refresh();
  return done("Changes saved.");
}
