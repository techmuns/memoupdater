// Wrangler typegen does not include secrets. This augmentation adds
// LLM_API_KEY to the global Env interface so c.env.LLM_API_KEY is typed
// as an optional string even when the secret has not been set.
declare global {
  interface Env {
    LLM_API_KEY?: string;
  }
}
export {};
