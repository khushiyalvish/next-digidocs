// Suite kit v8: copied from OnePortal src/lib/test-users.ts. Change it in the hub first, then copy it here.
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
 *
 * Which addresses count as test users is the TEST_USER_EMAIL_DOMAINS setting (default
 * `oneportal.test`, a domain that can never receive mail). A test installation may add the
 * organisation's own domain so testers sign in with their own addresses. Every seed and the
 * `test-users` part of `npm run data:clear` create, change or delete only addresses in that list.
 */

/** RFC 2606: can never receive mail, so a test user there is never a real mailbox. */
export const DEFAULT_TEST_USER_EMAIL_DOMAINS: readonly string[] = ["oneportal.test"];

/** The part after the first "@", lower-cased. SQL's twin: SUBSTRING(email, CHARINDEX('@', email) + 1, 254). */
export function emailDomain(email: string): string {
  return email.slice(email.indexOf("@") + 1).toLowerCase();
}

/** How the seeds tell a test account from a person's: nothing else may be created or changed by them. */
export function isTestUserEmail(email: string, domains: readonly string[]): boolean {
  return domains.includes(emailDomain(email));
}

/** "@oneportal.test or @example.com", for messages. */
export function describeTestDomains(domains: readonly string[]): string {
  return domains.map((domain) => `@${domain}`).join(" or ");
}

export const testUserSchema = z.object({
  // The person's id in the hub, fixed in the file: the application stores it as its link to the hub.
  id: idSchema,
  email: emailSchema,
  fullName: fullNameSchema,
});

export type TestUser = z.infer<typeof testUserSchema>;

const MAX_TEST_USERS = 200;

/**
 * The shape of `database/seed/test-users.json`. Pass `testUserSchema` (what the hub does) or an
 * application's extension of it, and the installation's test domains (`getConfig()`): an address
 * outside them refuses the whole file.
 */
export function testUsersFileSchema<User extends z.ZodType<TestUser>>(user: User, domains: readonly string[]) {
  return z
    .object({
      users: z.array(user).min(1, "List at least one user").max(MAX_TEST_USERS, `List at most ${MAX_TEST_USERS} users`),
    })
    .superRefine((file, ctx) => {
      file.users.forEach((each, index) => {
        if (!isTestUserEmail(each.email, domains)) {
          ctx.addIssue({
            code: "custom",
            path: ["users", index, "email"],
            message: `Use an address ending in ${describeTestDomains(domains)} (TEST_USER_EMAIL_DOMAINS)`,
          });
        }
      });
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
