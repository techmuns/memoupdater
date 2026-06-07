import type { LlmProvider } from "./types";
import { createAnthropicProvider } from "./anthropic";

// Wrangler typegen narrows vars to their default literal values. This
// widened view reflects the actual runtime shape — any of these may be
// undefined or any string at runtime.
interface LlmEnv {
  LLM_ENABLED?: string;
  LLM_PROVIDER?: string;
  LLM_MODEL?: string;
  LLM_API_KEY?: string;
}

function readEnv(env: Env): LlmEnv {
  return env as unknown as LlmEnv;
}

export function getProvider(env: Env): LlmProvider | null {
  const e = readEnv(env);
  if (e.LLM_ENABLED !== "true") return null;
  const apiKey = e.LLM_API_KEY;
  const model = e.LLM_MODEL;
  if (!apiKey || !model) return null;
  if (e.LLM_PROVIDER !== "anthropic") return null;
  return createAnthropicProvider(apiKey, model);
}

export function describeProvider(env: Env): {
  provider?: "anthropic";
  model?: string;
} {
  const e = readEnv(env);
  const provider = e.LLM_PROVIDER === "anthropic" ? "anthropic" : undefined;
  const model = e.LLM_MODEL || undefined;
  return { provider, model };
}
