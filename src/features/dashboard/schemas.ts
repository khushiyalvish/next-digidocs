import { z } from "zod";
import { idSchema } from "@/lib/schemas";

/**
 * The dashboard's address-bar choices: transaction type ("Particular") and enterprise. A missing
 * or malformed value gives the default view, never an error (hub CHILD-APP-GUIDE §7.4 rule 5).
 */
export const dashboardFilterSchema = z.object({
  type: idSchema.optional().catch(undefined),
  enterprise: idSchema.optional().catch(undefined),
});
