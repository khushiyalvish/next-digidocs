// Suite kit v7: copied from OnePortal src/lib/result.ts. Change it in the hub first, then copy it here.
import type { z } from "zod";

/**
 * The one result shape every entry point returns (ARCHITECTURE.md §5).
 *
 * Expected failures (wrong password, not found, duplicate email) are RETURNED as { ok: false }.
 * Unexpected failures (database down) THROW and reach the error boundary.
 */
export type Result<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: ErrorCode; fieldErrors?: Record<string, string> };

/** Closed set. Add a value here rather than passing a bare string. */
export type ErrorCode =
  | "invalid_input"
  | "not_found"
  | "conflict"
  | "invalid_credentials"
  | "locked"
  | "invalid_client"
  | "invalid_grant";

/** What a server action used with <ActionForm> returns. */
export type ActionResult = Result<unknown>;

export function ok<T>(data: T, message?: string): Result<T> {
  return { ok: true, data, message };
}

export function done(message?: string): Result {
  return { ok: true, data: undefined, message };
}

export function fail(error: string, code?: ErrorCode, fieldErrors?: Record<string, string>) {
  return { ok: false, error, code, fieldErrors } as const;
}

export function notFound(what: string) {
  return fail(`${what} was not found.`, "not_found");
}

/** Turns a failed schema parse into field-level messages (first message per field). */
export function invalidInput(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "form";
    fieldErrors[field] ??= issue.message;
  }
  return fail("Please correct the highlighted fields.", "invalid_input", fieldErrors);
}
