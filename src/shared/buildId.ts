// Phase 6H: resolves the Vite-injected build id with a runtime-safe
// fallback. Vite's `define` text-replaces `__APP_BUILD_ID__` in both
// bundles at build time. In environments where that substitution never
// ran (vitest, tsx scripts, plain `tsc`), the global is genuinely
// undefined — `typeof` avoids a ReferenceError and we fall back to
// "dev" (which makes the version check a no-op locally).
export const APP_BUILD_ID: string =
  typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "dev";
