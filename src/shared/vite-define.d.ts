// Phase 6H: build id injected by Vite `define` (see vite.config.ts) into
// BOTH the client bundle and the Cloudflare Worker bundle in the same
// build invocation, so the two always carry the identical value within
// a deploy. The client compares its compiled-in value against the
// worker's /api/version response to detect a stale browser tab.
declare const __APP_BUILD_ID__: string;
