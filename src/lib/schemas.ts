// Suite kit v7: copied from OnePortal src/lib/schemas.ts. Change it in the hub first, then copy it here.
import { z } from "zod";

/**
 * Shared input building blocks (ARCHITECTURE.md §4). Feature schemas compose these; an input
 * shape is defined only in its feature's schemas.ts.
 */

/**
 * A database id. SQL Server returns ids upper-case; everything in the app uses lower-case, so
 * ids compare equal as strings. z.guid() (not z.uuid()) because NEWSEQUENTIALID() values do
 * not carry RFC 4122 version bits.
 */
export const idSchema = z.guid("Invalid id").transform((id) => id.toLowerCase());

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address").max(254, "Email is too long"));

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(200, "Name is too long");

/*
 * Unticked checkboxes are absent from the form. `.optional()` (not a union with z.undefined())
 * is what lets zod v4 accept a missing key inside z.object.
 */

/** An HTML checkbox: present ("on") when ticked, absent when not. */
export const checkboxSchema = z
  .union([z.literal("on"), z.literal("true")])
  .optional()
  .transform((value) => value !== undefined);

/** A group of checkboxes sharing one name: absent, one value, or several. */
export const idListSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]))
  .pipe(z.array(idSchema));

/** Empty form fields arrive as "" — treat them as "not given". */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .optional()
    .transform((value) => value || null);

/**
 * FormData → plain object for schema parsing. A name that appears more than once (a checkbox
 * group) becomes an array. Files are not accepted anywhere, so they are dropped.
 */
export function formToObject(formData: FormData): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue; // React's internal fields
    const values = formData.getAll(key).filter((value): value is string => typeof value === "string");
    if (values.length === 1) result[key] = values[0];
    else if (values.length > 1) result[key] = values;
  }
  return result;
}
