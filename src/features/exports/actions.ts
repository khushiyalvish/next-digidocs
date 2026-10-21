"use server";

import type { ActionResult } from "@/lib/result";
import { requireMenuItem } from "@/features/auth/guards";
import { hideExport } from "@/features/exports/writes";
import { deleteSubmission } from "@/features/workflow/delete";

/* Actions on exports. So far: Delete from the list (hides it; decision log 2026-10-14). */

export async function deleteExport(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const member = await requireMenuItem("/exports");
  return deleteSubmission(member, "export", formData, hideExport);
}
