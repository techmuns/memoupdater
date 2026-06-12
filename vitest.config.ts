import { defineConfig } from "vitest/config";
import path from "node:path";

// Phase 6H: isolated vitest config. Deliberately does NOT load the
// Cloudflare plugin (no worker runtime needed for these pure-logic
// fixture tests) but keeps the @ / @shared aliases and injects a
// deterministic __APP_BUILD_ID__ so buildId.ts resolves.
export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify("test"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/react-app"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
