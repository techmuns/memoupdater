// Self-contained Claude-via-AWS-Bedrock provider. Selected only when
// LLM_PROVIDER="bedrock" (see ./provider.ts::getProvider). Deleting this
// file + the "bedrock" case in provider.ts + the temp_claude_token env
// entries fully removes this path; it shares no code with openai.ts or
// anthropic.ts and does not alter their behavior.
//
// Uses the Bedrock Runtime Converse API with a bearer API key (Bedrock API
// keys), NOT SigV4 request signing:
//   POST https://bedrock-runtime.<region>.amazonaws.com/model/<model-id>/converse
//   Authorization: Bearer <temp_claude_token>
//
// Normalizes the response to the exact same LlmGenerateResult shape the
// OpenAI and Anthropic providers produce, so callers (src/worker/index.ts)
// see no difference in output shape based on which provider handled the
// request.
import type {
  LlmGenerateArgs,
  LlmGenerateResult,
  LlmProvider,
} from "./types";
import { combineWithTimeout, isTimeoutError } from "./abort";

export const DEFAULT_BEDROCK_REGION = "us-east-1";
// Assumption to verify against the actual target AWS account/region before
// relying on this in production — see PR description.
export const DEFAULT_BEDROCK_MODEL_ID =
  "us.anthropic.claude-sonnet-4-5-20250929-v1:0";

const TOOL_NAME = "emit_follow_up_memo";
const TIMEOUT_MS = 60_000;

interface BedrockToolUseBlock {
  toolUse?: { name?: string; input?: unknown };
}

interface BedrockConverseResponse {
  output?: { message?: { content?: BedrockToolUseBlock[] } };
  usage?: { inputTokens?: number; outputTokens?: number };
}

export function bedrockConverseUrl(region: string, model: string): string {
  return `https://bedrock-runtime.${region}.amazonaws.com/model/${model}/converse`;
}

export function createBedrockProvider(
  apiKey: string,
  model: string,
  region: string = DEFAULT_BEDROCK_REGION,
): LlmProvider {
  return {
    providerName: "bedrock",
    modelUsed: model,
    async generate(args: LlmGenerateArgs): Promise<LlmGenerateResult> {
      const { signal, clear } = combineWithTimeout(args.abortSignal, TIMEOUT_MS);
      try {
        const body = {
          system: [{ text: args.system }],
          messages: [{ role: "user", content: [{ text: args.user }] }],
          toolConfig: {
            tools: [
              {
                toolSpec: {
                  name: TOOL_NAME,
                  description:
                    "Emit a 9-section follow-up investment memo grounded only in the provided material.",
                  inputSchema: { json: args.jsonSchema },
                },
              },
            ],
            toolChoice: { tool: { name: TOOL_NAME } },
          },
          inferenceConfig: { maxTokens: args.maxTokens },
        };

        let res: Response;
        try {
          res = await fetch(bedrockConverseUrl(region, model), {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal,
          });
        } catch (err) {
          const aborted = signal.aborted;
          const timeout = isTimeoutError(err);
          if (aborted) {
            logFailure(model, timeout ? "timeout" : "abort");
            return {
              ok: false,
              code: timeout ? "timeout" : "llm_error",
              message: timeout
                ? "LLM request timed out"
                : "LLM request was aborted",
              providerName: "bedrock",
              modelUsed: model,
            };
          }
          logFailure(model, "network");
          return {
            ok: false,
            code: "llm_error",
            message: err instanceof Error ? err.message : "Network error",
            providerName: "bedrock",
            modelUsed: model,
          };
        }

        if (res.status === 401 || res.status === 403) {
          logFailure(model, "unauthorized");
          return {
            ok: false,
            code: "not_configured",
            message: "Provider rejected the API key",
            providerName: "bedrock",
            modelUsed: model,
          };
        }
        if (res.status === 429) {
          logFailure(model, "rate_limited");
          return {
            ok: false,
            code: "rate_limited",
            message: "Provider rate limit",
            providerName: "bedrock",
            modelUsed: model,
          };
        }
        if (!res.ok) {
          logFailure(model, `http_${res.status}`);
          return {
            ok: false,
            code: "llm_error",
            message: `Provider returned HTTP ${res.status}`,
            providerName: "bedrock",
            modelUsed: model,
          };
        }

        let payload: BedrockConverseResponse;
        try {
          payload = (await res.json()) as BedrockConverseResponse;
        } catch {
          logFailure(model, "json_parse");
          return {
            ok: false,
            code: "malformed_output",
            message: "Provider response was not valid JSON",
            providerName: "bedrock",
            modelUsed: model,
          };
        }

        const block = (payload.output?.message?.content ?? []).find(
          (b) => b.toolUse?.name === TOOL_NAME,
        );
        if (!block?.toolUse || block.toolUse.input === undefined) {
          logFailure(model, "no_tool_use");
          return {
            ok: false,
            code: "malformed_output",
            message:
              "Provider did not emit the emit_follow_up_memo tool call",
            providerName: "bedrock",
            modelUsed: model,
          };
        }

        const inputTokens = payload.usage?.inputTokens;
        const outputTokens = payload.usage?.outputTokens;
        console.log(
          JSON.stringify({
            event: "llm_generate_ok",
            provider: "bedrock",
            model,
            inputTokens,
            outputTokens,
          }),
        );
        return {
          ok: true,
          json: block.toolUse.input,
          providerName: "bedrock",
          modelUsed: model,
          inputTokens,
          outputTokens,
        };
      } finally {
        clear();
      }
    },
  };
}

function logFailure(model: string, errorType: string): void {
  console.log(
    JSON.stringify({
      event: "llm_generate_fail",
      provider: "bedrock",
      model,
      errorType,
    }),
  );
}
