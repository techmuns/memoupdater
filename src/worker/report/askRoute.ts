// POST /api/report/ask — answer a follow-up question STRICTLY from the stored
// comprehensive research report (no new web research). Lets the analyst probe a
// company using research we already ran. OpenAI-only, gate-checked, strict JSON,
// 200-with-safe-failure. NEVER logged: report text, question, prompts, api key.
import type { Context } from "hono";
import type {
  LlmGenerationErrorCode,
  ReportAskRequest,
  ReportAskResponse,
} from "@shared/types";
import { checkGateToken, evaluateLlmReadiness } from "../llm/provider";
import { callOpenAIResponses, defaultReasoningEffort } from "../llm/openai";

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_TOKENS = 2_500;
const TIMEOUT_MS = 60_000;
const GATE_HEADER = "x-memo-llm-gate";
const MAX_QUESTION_LEN = 800;
const PER_SECTION_CHAR_CAP = 4000;
const MAX_SECTIONS = 12;

const ASK_FORMAT_NAME = "report_answer";
const ASK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer"],
  properties: { answer: { type: "string" } },
} as const;

const SYSTEM = `You are a buy-side analyst answering a portfolio manager's follow-up question about a company, using ONLY the internal research report provided. Rules:
- Answer strictly from the report sections given. Do NOT use outside knowledge or invent numbers.
- If the report does not contain the answer, say so plainly ("The report doesn't cover this — it would need fresh research") and, if useful, point to the closest related section.
- Be concise and decision-oriented. Use Markdown; a short table is fine. Cite the report section name(s) you drew from.`;

export async function handleReportAsk(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  const declaredLength = Number(c.req.header("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) return c.json({ error: "payload_too_large" }, 413);
  let bodyText: string;
  try {
    bodyText = await c.req.raw.text();
  } catch {
    return c.json({ error: "body_unreadable" }, 400);
  }
  if (bodyText.length > MAX_BODY_BYTES) return c.json({ error: "payload_too_large" }, 413);
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const req = validate(parsed);
  if (!req) return c.json({ error: "invalid_request" }, 400);

  const readiness = evaluateLlmReadiness(c.env);
  if (!readiness.llmEnabled) return c.json(fail("not_configured", "LLM is not enabled."));
  if (!readiness.providerConfigured) return c.json(fail("provider_missing", "LLM provider is not configured."));
  if (readiness.provider !== "openai") return c.json(fail("provider_missing", "Q&A requires the OpenAI provider."));
  if (!readiness.apiKeyConfigured) return c.json(fail("api_key_missing", "LLM API key is not configured."));
  if (readiness.gateEnabled) {
    const gate = checkGateToken(c.env, c.req.header(GATE_HEADER));
    if (!gate.ok) return c.json(fail(gate.code, gate.message));
  }
  const apiKey = readResolvedApiKey(c.env);
  if (!apiKey || !readiness.model) return c.json(fail("not_configured", "Provider unavailable."));

  const reportBlock = req.report
    .slice(0, MAX_SECTIONS)
    .map((s) => `## ${s.title}\n${clip(s.markdown, PER_SECTION_CHAR_CAP)}`)
    .join("\n\n");
  const user = `Company: ${req.company}
${req.memoContext ? `\nOriginal memo context:\n${clip(req.memoContext, 3000)}\n` : ""}
QUESTION: ${req.question}

INTERNAL RESEARCH REPORT (answer only from this):
${reportBlock}

Return JSON: { "answer": "<Markdown answer, citing the report section(s) used>" }`;

  try {
    const call = await callOpenAIResponses({
      apiKey,
      model: readiness.model,
      system: SYSTEM,
      user,
      schema: ASK_SCHEMA as unknown as Record<string, unknown>,
      schemaName: ASK_FORMAT_NAME,
      maxTokens: MAX_OUTPUT_TOKENS,
      timeoutMs: TIMEOUT_MS,
      reasoningEffort: defaultReasoningEffort(readiness.model),
      abortSignal: c.req.raw.signal,
      logEventTag: "llm_report_ask",
    });
    if (!call.ok) return c.json(fail(translate(call.code), call.message));
    const answer =
      call.parsed && typeof (call.parsed as { answer?: unknown }).answer === "string"
        ? ((call.parsed as { answer: string }).answer)
        : "";
    if (!answer.trim()) return c.json(fail("parse_error", "Empty answer."));
    const body: ReportAskResponse = {
      ok: true,
      answer,
      providerMetadata: {
        providerName: "openai",
        modelUsed: readiness.model,
        inputTokens: call.inputTokens,
        outputTokens: call.outputTokens,
      },
    };
    return c.json(body);
  } catch {
    return c.json(fail("provider_error", "Internal Q&A error."));
  }
}

function validate(input: unknown): ReportAskRequest | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  if (typeof o.question !== "string" || o.question.trim().length === 0) return null;
  if (typeof o.company !== "string") return null;
  if (!Array.isArray(o.report) || o.report.length === 0) return null;
  const report: { title: string; markdown: string }[] = [];
  for (const s of o.report) {
    if (!s || typeof s !== "object") continue;
    const rec = s as Record<string, unknown>;
    if (typeof rec.title === "string" && typeof rec.markdown === "string") {
      report.push({ title: rec.title, markdown: rec.markdown });
    }
  }
  if (report.length === 0) return null;
  return {
    question: o.question.slice(0, MAX_QUESTION_LEN),
    company: o.company,
    report,
    memoContext: typeof o.memoContext === "string" ? o.memoContext : undefined,
  };
}

function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max)}\n…[truncated]`;
}

interface EnvWithKey {
  LLM_API_KEY?: string;
  OPENAI_API_KEY?: string;
  LLM_PROVIDER?: string;
}
function readResolvedApiKey(env: Env): string | undefined {
  const e = env as unknown as EnvWithKey;
  if (e.LLM_API_KEY && e.LLM_API_KEY.length > 0) return e.LLM_API_KEY;
  if (e.LLM_PROVIDER === "openai" && e.OPENAI_API_KEY && e.OPENAI_API_KEY.length > 0) {
    return e.OPENAI_API_KEY;
  }
  return undefined;
}

function fail(code: LlmGenerationErrorCode, message: string): ReportAskResponse {
  return { ok: false, code, message };
}

function translate(
  code: "llm_error" | "timeout" | "malformed_output" | "rate_limited" | "not_configured",
): LlmGenerationErrorCode {
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
