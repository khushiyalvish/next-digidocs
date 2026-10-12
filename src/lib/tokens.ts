// Suite kit v7: copied from OnePortal src/lib/tokens.ts. Change it in the hub first, then copy it here.
import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Random secrets: session tokens, one-time SSO codes, password links, app secrets.
 *
 * The plain value is given out once (cookie, URL, screen); only its SHA-256 hash is stored.
 * A plain hash is enough here because these values are 256 random bits — unlike passwords,
 * they cannot be guessed, so a slow hash adds nothing (passwords: see password.ts).
 */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Compares a presented secret with a stored hash in constant time. */
export function tokenMatchesHash(token: string, storedHash: string): boolean {
  const presented = Buffer.from(hashToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return presented.length === stored.length && timingSafeEqual(presented, stored);
}
