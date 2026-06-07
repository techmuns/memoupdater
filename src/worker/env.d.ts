// Wrangler typegen does not include secrets. This augmentation adds the
// Phase 4A/4B secrets to the global Env interface so they are typed as
// optional strings even when not yet set in the deployment environment.
declare global {
  interface Env {
    LLM_API_KEY?: string;
    LLM_GATE_SECRET?: string;
  }
}
export {};
