// Phase 6A: Memo Understanding Engine. POST /api/memo/understand turns
// extracted memo text into a strict-schema MemoUnderstanding object that
// drives downstream memo-specific research and section generation.
//
// Discipline (mirrors Phase 5E/5F):
// - OpenAI only (provider_missing otherwise).
// - NO web_search, NO tools, NO tool_choice, NO include.
// - Strict JSON schema (Responses API json_schema, strict: true).
// - Extract+repair ladder: extractFirstJsonObject → strict shape → if fail,
//   ONE focused repair OpenAI call → strict shape → if still fail,
//   parse_error.
// - max_output_tokens: 4_000 normal / 2_500 repair.
// - Counts-only logging. NEVER log memo text, raw output, prompts, API
//   key, or c.env.
import type { Context } from "hono";
import type {
  LlmGenerationWarning,
  LlmProviderName,
  MemoUnderstandErrorCode,
  MemoUnderstandRequest,
  MemoUnderstandResponse,
} from "@shared/types";
import {
  checkGateToken,
  evaluateLlmReadiness,
  getProviderName,
} from "../llm/provider";
import { callOpenAIResponses } from "../llm/openai";
import { extractFirstJsonObject } from "../llm/jsonRepair";
import { buildUnderstandPrompt } from "./prompt";
import {
  MEMO_UNDERSTANDING_FORMAT_NAME,
  MEMO_UNDERSTANDING_OPENAI_SCHEMA,
  normalizeUnderstandingNulls,
} from "./schema";
import { parseUnderstandJson } from "./parse";
import { trimForUnderstanding } from "./trim";

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const UNDERSTAND_MAX_OUTPUT_TOKENS = 2_400;
const UNDERSTAND_REPAIR_MAX_OUTPUT_TOKENS = 1_600;
const GATE_HEADER = "x-memo-llm-gate";

export async function handleMemoUnderstand(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  const declaredLength = Number(c.req.header("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return c.json({ error: "payload_too_large" }, 413);
  }
  let bodyText: string;
  try {
    bodyText = await c.req.raw.text();
  } catch {
    return c.json({ error: "body_unreadable" }, 400);
  }
  if (bodyText.length > MAX_BODY_BYTES) {
    return c.json({ error: "payload_too_large" }, 413);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const validation = validateUnderstandRequest(parsed);
  if (!validation.ok) {
    return c.json(
      { error: "invalid_request", message: validation.message },
      400,
    );
  }

  const readiness = evaluateLlmReadiness(c.env);
  if (!readiness.llmEnabled) {
    return c.json(
      buildSafeFailure(
        "not_configured",
        "LLM is not enabled on this server.",
      ),
    );
  }
  if (!readiness.providerConfigured) {
    return c.json(
      buildSafeFailure(
        "provider_missing",
        "LLM provider is not configured.",
        readiness.provider,
        readiness.model,
      ),
    );
  }
  if (readiness.provider !== "openai") {
    return c.json(
      buildSafeFailure(
        "research_unavailable",
        "Memo understanding requires the OpenAI provider.",
        readiness.provider,
        readiness.model,
      ),
    );
  }
  if (!readiness.apiKeyConfigured) {
    return c.json(
      buildSafeFailure(
        "api_key_missing",
        "LLM API key is not configured.",
        readiness.provider,
        readiness.model,
      ),
    );
  }
  if (readiness.gateEnabled) {
    const gate = checkGateToken(c.env, c.req.header(GATE_HEADER));
    if (!gate.ok) {
      return c.json(
        buildSafeFailure(
          gate.code,
          gate.message,
          readiness.provider,
          readiness.model,
        ),
      );
    }
  }
  const providerName = getProviderName(c.env);
  if (providerName !== "openai") {
    return c.json(
      buildSafeFailure(
        "research_unavailable",
        "Memo understanding provider unavailable.",
        readiness.provider,
        readiness.model,
      ),
    );
  }
  const apiKey = readResolvedApiKey(c.env);
  if (!apiKey || !readiness.model) {
    return c.json(
      buildSafeFailure(
        "not_configured",
        "Memo understanding provider is not available.",
        readiness.provider,
        readiness.model,
      ),
    );
  }

  try {
    const trim = trimForUnderstanding(validation.value.memo.text);
    const prompt = buildUnderstandPrompt(validation.value, trim.text);

    console.log(
      JSON.stringify({
        event: "llm_understand_enter",
        projectId: validation.value.project.id,
        memoTextLen: trim.inputLen,
        trimmedLen: trim.outputLen,
        sectionsKept: trim.sectionsKept,
        fallbackUsed: trim.fallbackUsed,
        maxTokens: UNDERSTAND_MAX_OUTPUT_TOKENS,
        model: readiness.model,
      }),
    );

    const call = await callOpenAIResponses({
      apiKey,
      model: readiness.model,
      system: prompt.system,
      user: prompt.user,
      schema: MEMO_UNDERSTANDING_OPENAI_SCHEMA,
      schemaName: MEMO_UNDERSTANDING_FORMAT_NAME,
      maxTokens: UNDERSTAND_MAX_OUTPUT_TOKENS,
      abortSignal: c.req.raw.signal,
      logEventTag: "llm_understand",
    });

    if (!call.ok) {
      if (call.code === "malformed_output" && typeof call.rawText === "string") {
        return await tryRepair(
          c,
          call.rawText,
          validation.value,
          readiness,
          apiKey,
        );
      }
      return c.json(
        buildSafeFailure(
          translateProviderFailToUnderstandCode(call.code),
          call.message,
          readiness.provider,
          readiness.model,
        ),
      );
    }

    // Normal path: strict-shape the OpenAI response directly.
    const normalized = normalizeUnderstandingNulls(call.parsed);
    const shape = parseUnderstandJson(normalized, validation.value.project.id);
    if (!shape.ok) {
      // The provider returned valid JSON but the shape didn't validate.
      // Repair ladder fires on strict-shape failures too (it can fix
      // missing required fields).
      const rawJson = JSON.stringify(call.parsed);
      return await tryRepair(
        c,
        rawJson,
        validation.value,
        readiness,
        apiKey,
      );
    }

    const body: MemoUnderstandResponse = {
      ok: true,
      understanding: shape.understanding,
      providerMetadata: {
        providerName: "openai",
        modelUsed: readiness.model,
        inputTokens: call.inputTokens,
        outputTokens: call.outputTokens,
      },
      warnings: [],
    };
    return c.json(body);
  } catch {
    console.log(
      JSON.stringify({
        event: "llm_understand_unexpected_fail",
        provider: readiness.provider,
        model: readiness.model,
        errorType: "internal",
      }),
    );
    return c.json(
      buildSafeFailure(
        "provider_error",
        "Internal memo-understanding error.",
        readiness.provider,
        readiness.model,
      ),
    );
  }
}

async function tryRepair(
  c: Context<{ Bindings: Env }>,
  rawText: string,
  request: MemoUnderstandRequest,
  readiness: ReturnType<typeof evaluateLlmReadiness>,
  apiKey: string,
): Promise<Response> {
  console.log(
    JSON.stringify({
      event: "llm_understand_repair_enter",
      projectId: request.project.id,
      rawLength: rawText.length,
      repairAttempted: true,
    }),
  );

  // First try extractFirstJsonObject (cheap, no provider call) — strips
  // code fences, extracts the first balanced JSON object.
  const extracted = extractFirstJsonObject(rawText);
  if (extracted.ok) {
    const normalized = normalizeUnderstandingNulls(extracted.value);
    const shape = parseUnderstandJson(normalized, request.project.id);
    if (shape.ok) {
      const warnings: LlmGenerationWarning[] = [
        {
          code: "schema_warning",
          message: "Recovered memo understanding via JSON extract.",
        },
      ];
      const body: MemoUnderstandResponse = {
        ok: true,
        understanding: shape.understanding,
        providerMetadata: {
          providerName: "openai",
          modelUsed: readiness.model ?? "unknown",
        },
        warnings,
      };
      return c.json(body);
    }
  }

  // Otherwise, a single focused repair OpenAI call.
  const repair = await callOpenAIResponses({
    apiKey,
    model: readiness.model ?? "",
    system: REPAIR_SYSTEM,
    user: buildRepairUser(rawText, request.project.id),
    schema: MEMO_UNDERSTANDING_OPENAI_SCHEMA,
    schemaName: MEMO_UNDERSTANDING_FORMAT_NAME,
    maxTokens: UNDERSTAND_REPAIR_MAX_OUTPUT_TOKENS,
    abortSignal: c.req.raw.signal,
    logEventTag: "llm_understand_repair",
  });

  if (!repair.ok) {
    return c.json(
      buildSafeFailure(
        translateProviderFailToUnderstandCode(repair.code),
        repair.message,
        "openai",
        readiness.model,
      ),
    );
  }

  const normalized = normalizeUnderstandingNulls(repair.parsed);
  const shape = parseUnderstandJson(normalized, request.project.id);
  if (!shape.ok) {
    return c.json(
      buildSafeFailure(
        "parse_error",
        shape.message,
        "openai",
        readiness.model,
      ),
    );
  }
  const warnings: LlmGenerationWarning[] = [
    {
      code: "schema_warning",
      message: "Memo understanding recovered via JSON repair.",
    },
  ];
  const body: MemoUnderstandResponse = {
    ok: true,
    understanding: shape.understanding,
    providerMetadata: {
      providerName: "openai",
      modelUsed: readiness.model ?? "unknown",
      inputTokens: repair.inputTokens,
      outputTokens: repair.outputTokens,
    },
    warnings,
  };
  return c.json(body);
}

const REPAIR_SYSTEM = [
  "You are a JSON repair assistant. Convert the user-supplied draft into a single valid JSON object that matches the MemoUnderstanding schema exactly.",
  "Preserve every fact present in the draft — numbers, dates, claims, quotes.",
  "Do NOT add new facts. Do NOT change meaning. Do NOT invent values.",
  "If the draft is truncated mid-array or mid-string, OMIT the incomplete tail rather than invent a completion.",
  "For required fields the draft omits entirely: leave string fields as empty string, list fields as empty array, nullable fields as null.",
  "Emit a SINGLE JSON object. No prose outside the JSON. No code fences.",
].join("\n");

function buildRepairUser(rawText: string, projectId: string): string {
  // Cap repair input to keep the call cheap.
  const capped =
    rawText.length > 24_000 ? `${rawText.slice(0, 24_000)}\n…[truncated]` : rawText;
  return [
    `Project id: ${projectId} (the output's projectId must equal this exactly).`,
    "",
    "Draft (may be wrapped in prose, code fences, or truncated):",
    "```text",
    capped,
    "```",
    "",
    "Emit one valid JSON object matching the MemoUnderstanding schema.",
  ].join("\n");
}

// --- helpers ---

interface EnvWithKey {
  LLM_API_KEY?: string;
  OPENAI_API_KEY?: string;
  LLM_PROVIDER?: string;
}

function readResolvedApiKey(env: Env): string | undefined {
  const e = env as unknown as EnvWithKey;
  if (e.LLM_API_KEY && e.LLM_API_KEY.length > 0) return e.LLM_API_KEY;
  if (
    e.LLM_PROVIDER === "openai" &&
    e.OPENAI_API_KEY &&
    e.OPENAI_API_KEY.length > 0
  ) {
    return e.OPENAI_API_KEY;
  }
  return undefined;
}

function buildSafeFailure(
  code: MemoUnderstandErrorCode,
  message: string,
  providerName?: LlmProviderName,
  modelUsed?: string,
): MemoUnderstandResponse {
  return { ok: false, code, message, providerName, modelUsed };
}

function translateProviderFailToUnderstandCode(
  code:
    | "llm_error"
    | "timeout"
    | "malformed_output"
    | "rate_limited"
    | "not_configured",
): MemoUnderstandErrorCode {
  switch (code) {
    case "llm_error":
      return "provider_error";
    case "malformed_output":
      return "parse_error";
    case "timeout":
      return "timeout";
    case "rate_limited":
      return "rate_limited";
    case "not_configured":
      return "not_configured";
  }
}

type ValidationResult =
  | { ok: true; value: MemoUnderstandRequest }
  | { ok: false; message: string };

function validateUnderstandRequest(input: unknown): ValidationResult {
  if (!isPlainObject(input)) return invalid("request must be an object");
  const project = input.project;
  if (!isPlainObject(project)) return invalid("project missing");
  if (typeof project.id !== "string" || project.id.length === 0)
    return invalid("project.id missing");
  if (typeof project.companyName !== "string" || project.companyName.length === 0)
    return invalid("project.companyName missing");

  const memo = input.memo;
  if (!isPlainObject(memo)) return invalid("memo missing");
  if (typeof memo.text !== "string" || memo.text.length === 0)
    return invalid("memo.text missing");
  if (typeof memo.sourceFilename !== "string")
    return invalid("memo.sourceFilename missing");
  if (typeof memo.sizeBytes !== "number")
    return invalid("memo.sizeBytes missing");

  if (input.detection !== undefined && !isPlainObject(input.detection)) {
    return invalid("detection must be an object when provided");
  }
  if (input.dna !== undefined && !isPlainObject(input.dna)) {
    return invalid("dna must be an object when provided");
  }

  return { ok: true, value: input as unknown as MemoUnderstandRequest };
}

function invalid(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
