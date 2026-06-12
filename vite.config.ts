import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import path from "node:path";

// Phase 6H: a single build id, computed once per `vite build` and
// injected into BOTH the client and worker bundles via `define`. On a
// Cloudflare deploy this is the commit SHA; locally it's a timestamp.
// Because the value is resolved once here and both environments build
// in the same invocation, client and worker always agree within a
// deploy — which is exactly what the stale-tab handshake needs.
const APP_BUILD_ID =
  process.env.WORKERS_CI_COMMIT_SHA ||
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  Date.now().toString(36);

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  define: {
    __APP_BUILD_ID__: JSON.stringify(APP_BUILD_ID),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/react-app"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
});
