// Suite kit v7: copied from OnePortal src/lib/urls.ts. Change it in the hub first, then copy it here.
/**
 * Where to send someone after signing in. Only same-site paths are allowed; anything else
 * (https://evil.example, //evil.example, /\evil.example) falls back to the launcher, so the
 * `next` parameter cannot be used as an open redirect.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  // Control characters (tabs, newlines) are stripped by browsers and can smuggle a host in.
  if (/[\u0000-\u001f\u007f]/.test(next)) return "/";
  return next;
}

/** Adds query parameters to an absolute URL, keeping any it already has. */
export function withQuery(url: string, params: Record<string, string | undefined>): string {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) target.searchParams.set(key, value);
  }
  return target.toString();
}
