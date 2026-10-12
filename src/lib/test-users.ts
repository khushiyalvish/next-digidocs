// Suite kit v7: copied from OnePortal src/lib/test-users.ts. Change it in the hub first, then copy it here.
import { z } from "zod";
import { emailSchema, fullNameSchema, idSchema } from "@/lib/schemas";

/**
 * Test users (CHILD-APP-GUIDE.md §5.8): people who exist only so that a test installation can be
 * used from its first day. Each suite application lists its own in
 * `database/seed/test-users.json`; the hub and the application both create them from that one
 * file, under the same ids, so neither has to call the other.
 *
 * The hub reads `id`, `email` and `fullName` and nothing else. Whatever else an application needs
 * to know about a test user (a role, several roles, a supervisor, a branch…) is its own business:
 * it extends `testUserSchema` with those fields.
 */

/** A domain that can never receive mail (RFC 2606), so a test user is never a real mailbox. */
export const TEST_USER_EMAIL_DOMAIN = "oneportal.test";

/** How the seeds tell a test account from a person's: nothing else may be created or changed by them. */
export function isTestUserEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${TEST_USER_EMAIL_DOMAIN}`);
}

export const testUserSchema = z.object({
  // The person's id in the hub, fixed in the file: the application stores it as its link to the hub.
  id: idSchema,
  email: emailSchema.refine(isTestUserEmail, `Use an address ending in @${TEST_USER_EMAIL_DOMAIN}`),
  fullName: fullNameSchema,
});

export type TestUser = z.infer<typeof testUserSchema>;

const MAX_TEST_USERS = 200;

/**
 * The shape of `database/seed/test-users.json`. Pass `testUserSchema` (what the hub does) or an
 * application's extension of it.
 */
export function testUsersFileSchema<User extends z.ZodType<TestUser>>(user: User) {
  return z
    .object({
      users: z.array(user).min(1, "List at least one user").max(MAX_TEST_USERS, `List at most ${MAX_TEST_USERS} users`),
    })
    .superRefine((file, ctx) => {
      for (const field of ["id", "email"] as const) {
        const seen = new Set<string>();
        file.users.forEach((each, index) => {
          if (seen.has(each[field])) {
            ctx.addIssue({ code: "custom", path: ["users", index, field], message: "Appears more than once in this file" });
          }
          seen.add(each[field]);
        });
      }
    });
}
