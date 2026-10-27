import { z } from "zod";
import { idSchema } from "@/lib/schemas";

/** How many days the dashboard can look back (the period, today included). */
export const DASHBOARD_RANGES = [7, 30, 90] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];
export const DEFAULT_DASHBOARD_RANGE: DashboardRange = 30;

/**
 * The dashboard's address-bar choices: the period, transaction type ("Particular"), enterprise
 * and "Show sample data". A missing or malformed value gives the default view, never an error
 * (hub CHILD-APP-GUIDE §7.4 rule 5). The enterprise is only a candidate: the page keeps it when
 * the viewer may choose it (an Enterprise user is always held to their own).
 */
export const dashboardFilterSchema = z.object({
  range: z
    .enum(DASHBOARD_RANGES.map(String) as [string, ...string[]])
    .catch(String(DEFAULT_DASHBOARD_RANGE))
    .default(String(DEFAULT_DASHBOARD_RANGE))
    .transform((value) => Number(value) as DashboardRange),
  type: idSchema.optional().catch(undefined),
  enterprise: idSchema.optional().catch(undefined),
  // "?sample=1" swaps the figures for made-up ones; anything else is "off".
  sample: z
    .string()
    .optional()
    .catch(undefined)
    .transform((value) => value === "1"),
});

export type DashboardFilter = z.infer<typeof dashboardFilterSchema>;
