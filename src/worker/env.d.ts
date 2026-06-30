// Wrangler typegen does not include secrets. This augmentation adds the
// Phase 4A/4B secrets to the global Env interface so they are typed as
// optional strings even when not yet set in the deployment environment.
declare global {
  interface Env {
    LLM_API_KEY?: string;
    LLM_GATE_SECRET?: string;
    // Bearer token for the upstream stock-search service (devde.muns.io),
    // used by POST /api/stock/search. Set with `wrangler secret put
    // MUNS_ACCESS_TOKEN`; never committed.
    MUNS_ACCESS_TOKEN?: string;
    // KV namespace backing the cross-device saved-memo library
    // (GET/PUT/DELETE /api/memos). Optional: when the binding is absent the
    // memo endpoints report `synced:false` and the client falls back to
    // local-only storage. Provision once with
    // `wrangler kv namespace create MEMOS`, then add the binding to
    // wrangler.jsonc (see the commented `kv_namespaces` block there).
    MEMOS?: KVNamespace;
  }
}
export {};
