// Suite kit v7: copied from OnePortal src/lib/sql-text.ts. Change it in the hub first, then copy it here.
/**
 * Makes user input literal inside a LIKE pattern: %, _ and [ lose their wildcard meaning.
 * Use with `LIKE ${pattern} ESCAPE '\\'` (the escape character is a single backslash).
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_[]/g, (character) => `\\${character}`);
}

/** "%value%" for a contains-search, or null when there is nothing to search for. */
export function containsPattern(value: string | undefined): string | null {
  return value ? `%${escapeLike(value)}%` : null;
}
