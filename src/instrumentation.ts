// Suite kit v7: copied from OnePortal src/instrumentation.ts. Change it in the hub first, then copy it here.
/**
 * Runs once when the server starts. Validating the settings here means a missing or malformed
 * setting stops the server with a readable list, instead of failing the first request that
 * needs it (ARCHITECTURE.md §8e).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getConfig } = await import("@/lib/config");
    getConfig();
  }
}
