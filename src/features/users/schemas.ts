import { z } from "zod";
import { checkboxSchema, idSchema } from "@/lib/schemas";
import { ROLE_KEYS, ROLES } from "@/features/access/roles";

/** "" (the "No access yet" choice) → null. */
const roleChoice = z
  .union([z.enum(ROLE_KEYS), z.literal("")])
  .optional()
  .transform((value) => value || null);

const optionalId = z
  .union([idSchema, z.literal("")])
  .optional()
  .transform((value) => value || null);

const mobileNumber = z
  .string()
  .trim()
  .max(30, "Use at most 30 characters")
  .regex(/^[0-9+()\-\s]*$/, "Use digits, spaces and + ( ) - only")
  .optional()
  .transform((value) => value || null);

/**
 * What an LFZ Admin sets on a person. An Enterprise user needs an organisation; for every other
 * role the organisation is dropped (the database refuses the combination too, 0002_access.sql).
 */
export const userAccessSchema = z
  .object({
    userId: idSchema,
    role: roleChoice,
    organisationId: optionalId,
    mobileNumber,
    isActive: checkboxSchema,
  })
  .transform((value) => ({
    ...value,
    organisationId: value.role && ROLES[value.role].needsOrganisation ? value.organisationId : null,
  }))
  .superRefine((value, ctx) => {
    if (value.role && ROLES[value.role].needsOrganisation && !value.organisationId) {
      ctx.addIssue({ code: "custom", path: ["organisationId"], message: "Choose the organisation this person works for" });
    }
  });

export type UserAccess = z.infer<typeof userAccessSchema>;

export const USER_STATUSES = ["waiting", "active", "inactive"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** The user list's address-bar filters. Anything malformed falls back to "no filter". */
export const userListFilterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  role: z.enum(ROLE_KEYS).optional().catch(undefined),
  status: z.enum(USER_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});
