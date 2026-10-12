import { z } from "zod";
import { testUserSchema } from "@/lib/test-users";
import { ROLE_KEYS, ROLES } from "@/features/access/roles";

/**
 * What DigiDocs knows about a test user (database/seed/test-users.json; hub CHILD-APP-GUIDE.md
 * §5.8): the hub's three fields, plus their role (null: a person still waiting for access) and,
 * for an Enterprise user, the short code of their organisation. A new role or any other attribute
 * people are told apart by is added here, given a test user in the file, and written by
 * `saveTestUser` — in the same change.
 */
export const appTestUserSchema = testUserSchema
  .extend({
    role: z.enum(ROLE_KEYS).nullable(),
    organisationShortCode: z.string().trim().toUpperCase().min(1).max(20).nullable(),
  })
  .superRefine((user, ctx) => {
    const needsOrganisation = user.role !== null && ROLES[user.role].needsOrganisation;
    if (needsOrganisation !== (user.organisationShortCode !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["organisationShortCode"],
        message: needsOrganisation ? "An Enterprise user needs an organisation" : "Only an Enterprise user has an organisation",
      });
    }
  });

export type AppTestUser = z.infer<typeof appTestUserSchema>;
