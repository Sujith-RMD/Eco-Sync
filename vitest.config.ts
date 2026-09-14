import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      /*
        `server-only` is a marker package: its default entry throws on import,
        and only the `react-server` condition resolves to a no-op. Vitest sets
        no such condition, so a guarded module under test dies on load. Point at
        the package's own no-op build — the exact file a server component would
        resolve — so the suite loads guarded modules the way production does.

        The guard still bites where it matters: `next build` and the browser
        resolve the default entry, which is what turns "this module is
        confidential" into a compile-time failure instead of a convention.
      */
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
