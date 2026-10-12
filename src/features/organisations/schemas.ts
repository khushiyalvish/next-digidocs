import { z } from "zod";
import { checkboxSchema, idSchema, optionalText } from "@/lib/schemas";

/** A date from <input type="date"> ("YYYY-MM-DD"), or "" for none. */
const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || null)
  .refine((value) => value === null || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))), "Enter a valid date");

const organisationFields = {
  companyName: z.string().trim().min(1, "Enter the company name").max(300, "Use at most 300 characters"),
  shortCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Enter a short code")
    .max(20, "Use at most 20 characters"),
  orionCode: optionalText(100),
  registrationNumber: optionalText(100),
  registrationDate: optionalDate,
  licenceNumber: optionalText(100),
  licenceExpiresOn: optionalDate,
};

export const createOrganisationSchema = z.object(organisationFields);

export const updateOrganisationSchema = z.object({
  organisationId: idSchema,
  ...organisationFields,
  isActive: checkboxSchema,
});

export type OrganisationFields = z.infer<typeof createOrganisationSchema>;

export const ORGANISATION_STATUSES = ["active", "inactive", "licence-expired"] as const;

/** The organisation list's address-bar filters. Anything malformed falls back to "no filter". */
export const organisationListFilterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(ORGANISATION_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});
