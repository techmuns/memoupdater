// Worker-private LLM provider abstractions. Frontend code MUST NOT import
// from this file — shared request/response envelopes live in
// src/shared/types.ts.

import type { LlmProviderName } from "@shared/types";

export interface LlmGenerateArgs {
  system: string;
  user: string;
  jsonSchema: object;
  maxTokens: number;
  abortSignal?: AbortSignal;
}

export type LlmGenerateFailCode =
  | "llm_error"
  | "timeout"
  | "malformed_output"
  | "rate_limited"
  | "not_configured";

export type LlmGenerateResult =
  | {
      ok: true;
      json: unknown;
      providerName: LlmProviderName;
      modelUsed: string;
      inputTokens?: number;
      outputTokens?: number;
    }
  | {
      ok: false;
      code: LlmGenerateFailCode;
      message: string;
      providerName: LlmProviderName;
      modelUsed: string;
    };

export interface LlmProvider {
  readonly providerName: LlmProviderName;
  readonly modelUsed: string;
  generate(args: LlmGenerateArgs): Promise<LlmGenerateResult>;
}
