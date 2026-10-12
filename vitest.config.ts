// Suite kit v7: copied from OnePortal vitest.config.ts. Change it in the hub first, then copy it here.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Unit checks: pure rules, no database. `npm test`. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
