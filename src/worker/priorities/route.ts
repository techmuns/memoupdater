// POST /api/generate/priorities-answer — produces a dashboard-only Q&A
// object that directly answers the user's priority questions.
//
// Why a separate route at all: the main memo body deliberately does NOT
// take userPriorities anymore (the principle is "the downloadable memo is
// the same generic high-quality memo for every run; any PM-specific Q&A
// lives on the dashboard"). This route is the home for that Q&A.
//
// Discipline (mirrors /api/generate/memo-section):
// - OpenAI only.
// - Strict JSON schema (Responses API json_schema, strict: true).
// - Reasoning effort low + a generous max_output_tokens budget.
// - All failures return HTTP 200 { ok:false, code, message } so the client
//   degrades gracefully (the dashboard simply doesn't render the card).
// - NEVER logged: memo text, prompts, the API key, c.env, source quotes.
import type { Context } from "hono";
import type {
  GeneratePrioritiesAnswerRequest,
  GeneratePrioritiesAnswerResponse,
  LlmGenerationErrorCode,
  LlmProviderName,
  MemoConfidence,
  PrioritiesAnswer,
  PrioritiesAnswerItem,
} from "@shared/types";
import {
  checkGateToken,
  evaluateLlmReadiness,
} from "../llm/provider";
import { callOpenAIResponses, defaultReasoningEffort } from "../llm/openai";

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_TOKENS = 3_000;
const MAX_QUESTIONS = 8;
const GATE_HEADER = "x-memo-llm-gate";

const PRIORITIES_FORMAT_NAME = "priorities_answer";
const PRIORITIES_OPENAI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer", "confidence", "sources"],
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
          // strict mode requires these in `required`; the model emits null
          // when no value applies.
          confidence: {
            anyOf: [{ type: "null" }, { type: "string", enum: ["high", "medium", "low"] }],
          },
          sources: {
            anyOf: [
              { type: "null" },
              {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["documentId", "page", "quote"],
                  properties: {
                    documentId: { type: "string" },
                    page: { anyOf: [{ type: "null" }, { type: "integer" }] },
                    quote: { anyOf: [{ type: "null" }, { type: "string" }] },
                  },
                },
              },
            ],
          },
        },
      },
    },
  },
} as const;

export async function handlePrioritiesAnswer(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  const declaredLength = Number(c.req.header("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return c.json(fail("provider_error", "Request body too large."));
  }
  let bodyText: string;
  try {
    bodyText = await c.req.raw.text();
  } catch {
    return c.json(fail("provider_error", "Request body unreadable."));
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return c.json(fail("provider_error", "Request body must be JSON."));
  }
  const v = validate(parsed);
  if (!v.ok) return c.json(fail("provider_error", v.message));

  const readiness = evaluateLlmReadiness(c.env);
  if (!readiness.llmEnabled) {
    return c.json(fail("not_configured", "LLM is not enabled.", readiness.provider, readiness.model));
  }
  if (!readiness.providerConfigured || readiness.provider !== "openai") {
    return c.json(fail("provider_missing", "OpenAI provider required.", readiness.provider, readiness.model));
  }
  if (!readiness.apiKeyConfigured) {
    return c.json(fail("api_key_missing", "LLM API key missing.", readiness.provider, readiness.model));
  }
  if (readiness.gateEnabled) {
    const gate = checkGateToken(c.env, c.req.header(GATE_HEADER));
    if (!gate.ok) {
      return c.json(fail(gate.code, gate.message, readiness.provider, readiness.model));
    }
  }
  const apiKey = readEnvVar(c.env, "LLM_API_KEY") || readEnvVar(c.env, "OPENAI_API_KEY");
  if (!apiKey || !readiness.model) {
    return c.json(fail("not_configured", "LLM not available.", readiness.provider, readiness.model));
  }

  const req = v.value;
  const questions = splitQuestions(req.userPriorities);
  if (questions.length === 0) {
    return c.json(fail("provider_error", "No priority questions found."));
  }

  const prompt = buildPrompt(req, questions);

  try {
    const call = await callOpenAIResponses({
      apiKey,
      model: readiness.model,
      system: prompt.system,
      user: prompt.user,
      schema: PRIORITIES_OPENAI_SCHEMA,
      schemaName: PRIORITIES_FORMAT_NAME,
      maxTokens: MAX_OUTPUT_TOKENS,
      reasoningEffort: defaultReasoningEffort(readiness.model),
      abortSignal: c.req.raw.signal,
      logEventTag: "llm_priorities_answer",
    });
    if (!call.ok) {
      const code = translate(call.code);
      return c.json(fail(code, call.message, "openai", readiness.model));
    }
    const answer = shape(call.parsed, questions);
    if (!answer.ok) {
      return c.json(fail("parse_error", answer.message, "openai", readiness.model));
    }
    const body: GeneratePrioritiesAnswerResponse = {
      ok: true,
      answer: answer.value,
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
        event: "llm_priorities_answer_unexpected_fail",
        model: readiness.model,
      }),
    );
    return c.json(fail("provider_error", "Internal generation error.", "openai", readiness.model));
  }
}

function fail(
  code: LlmGenerationErrorCode,
  message: string,
  providerName?: LlmProviderName,
  modelUsed?: string,
): GeneratePrioritiesAnswerResponse {
  return { ok: false, code, message, providerName, modelUsed };
}

function readEnvVar(env: Env, key: string): string | undefined {
  const value = (env as unknown as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function translate(code: string): LlmGenerationErrorCode {
  switch (code) {
    case "malformed_output":
      return "parse_error";
    case "timeout":
      return "timeout";
    case "rate_limited":
      return "rate_limited";
    case "not_configured":
      return "not_configured";
    default:
      return "provider_error";
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validate(input: unknown): { ok: true; value: GeneratePrioritiesAnswerRequest } | { ok: false; message: string } {
  if (!isObj(input)) return { ok: false, message: "request must be an object" };
  if (!isObj(input.project)) return { ok: false, message: "project missing" };
  if (typeof input.project.id !== "string") return { ok: false, message: "project.id missing" };
  if (typeof input.project.companyName !== "string") return { ok: false, message: "project.companyName missing" };
  if (typeof input.project.ticker !== "string") return { ok: false, message: "project.ticker missing" };
  if (!isObj(input.dna)) return { ok: false, message: "dna missing" };
  if (typeof input.userPriorities !== "string" || input.userPriorities.trim().length === 0) {
    return { ok: false, message: "userPriorities must be a non-empty string" };
  }
  if (input.research !== null && !isObj(input.research)) {
    return { ok: false, message: "research must be an object or null" };
  }
  return { ok: true, value: input as unknown as GeneratePrioritiesAnswerRequest };
}

function splitQuestions(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, MAX_QUESTIONS);
}

function buildPrompt(
  req: GeneratePrioritiesAnswerRequest,
  questions: string[],
): { system: string; user: string } {
  const system = [
    "You are a buy-side analyst answering the portfolio manager's SPECIFIC follow-up questions about a company you've been tracking.",
    "You will be given (a) the questions, (b) the recent research findings, (c) the original memo's DNA, (d) optionally the memo-understanding digest.",
    "",
    "Output rules (HARD):",
    "- Emit EXACTLY one JSON object with `items: PrioritiesAnswerItem[]`. One item PER question, in the same order.",
    "- Each `question` field MUST echo the user's question verbatim (so the UI can pair them up).",
    "- Each `answer`: 2–4 sentences. Number-led where the data supports it. Investor-direct voice.",
    "- If the findings don't contain enough to answer cleanly, say so plainly ('Not surfaced in this run — recommend pulling the BSE shareholding-pattern XBRL') instead of guessing. Set `confidence: low` for those.",
    "- `confidence` ∈ {high, medium, low}: high when a primary/official source supports it; medium for credible press; low for sourced but partial / no source.",
    "- `sources`: 0–3 entries. Cite ONLY documentIds present in the 'Available document IDs' table; otherwise emit an empty array.",
    "- Never invent numbers, fund names, dates, or quotes. NEVER use process language ('this pass', 'tool results', 'research workflow').",
    "- NEVER reveal internal ids (r01 / f01 / local_initial_*) in the visible answer text.",
  ].join("\n");

  const lines: string[] = [];
  lines.push("# Project");
  lines.push(`- Company: ${req.project.companyName} (${req.project.ticker})`);
  if (req.project.sector) lines.push(`- Sector: ${req.project.sector}`);
  if (req.detection?.currentPrice) {
    const cp = req.detection.currentPrice;
    lines.push(`- Current price (server-fetched, live): ${cp.display}`);
    if (cp.fundamentalsDisplay) {
      lines.push(`- Fundamentals (server-fetched, live): ${cp.fundamentalsDisplay}`);
    }
  }
  if (req.detection?.memoWrittenOn) {
    lines.push(`- Original memo written on: ${req.detection.memoWrittenOn}`);
  }

  lines.push("");
  lines.push("# Questions to answer (in order)");
  questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));

  lines.push("");
  lines.push("# Research findings");
  if (!req.research || req.research.findings.length === 0) {
    lines.push("_No research findings available._");
  } else {
    for (const f of req.research.findings.slice(0, 12)) {
      lines.push(`## ${f.id} [${f.category}] ${f.title}`);
      lines.push(`Impact: ${f.impact}`);
      lines.push(`Summary: ${truncate(f.summary, 600)}`);
      if (f.sources.length > 0) {
        lines.push("Sources:");
        for (const s of f.sources.slice(0, 3)) {
          const date = s.date ? ` · ${s.date}` : "";
          const tier = s.tier ? ` · tier:${s.tier}` : "";
          lines.push(`  - ${s.title}${date}${tier}: ${s.url}`);
        }
      }
      lines.push("");
    }
  }

  lines.push("# Original memo DNA (compact)");
  if (req.dna.originalThesis) lines.push(`- Thesis: ${truncate(req.dna.originalThesis, 300)}`);
  if (req.dna.keyAssumptions.length > 0) {
    lines.push("- Key assumptions:");
    for (const a of req.dna.keyAssumptions.slice(0, 4)) lines.push(`  - ${truncate(a, 200)}`);
  }
  if (req.dna.valuationFramework) {
    lines.push(
      `- Valuation: ${req.dna.valuationFramework.method ?? "—"} / ${req.dna.valuationFramework.targetMultiple ?? "—"}`,
    );
  }

  if (req.memoUnderstandingDigest) {
    const d = req.memoUnderstandingDigest;
    lines.push("");
    lines.push("# Memo-understanding digest (anchor)");
    lines.push(`- One-line summary: ${d.oneLineSummary}`);
    if (d.recommendation) {
      const tgt = d.targetPrice ? ` · target ${d.targetPrice}` : "";
      lines.push(`- Recommendation: ${d.recommendation}${tgt}`);
    }
  }

  lines.push("");
  lines.push("# Available document IDs");
  if (req.initialMemoId) lines.push(`- ${req.initialMemoId} → original memo`);
  if (req.research) {
    for (const f of req.research.findings) {
      lines.push(`- ${f.id} → research finding (${f.category})`);
    }
  }

  lines.push("");
  lines.push("# Output requirements");
  lines.push(`- Emit EXACTLY one JSON object with ${questions.length} items, one per question above, in order.`);
  lines.push("- Each item's `question` MUST echo the user's question text verbatim.");
  lines.push("- Cite only documentIds in the table above.");

  return { system, user: lines.join("\n") };
}

function truncate(value: string, max: number): string {
  if (typeof value !== "string") return "";
  const s = value.trim();
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`;
}

interface ShapeOk {
  ok: true;
  value: PrioritiesAnswer;
}
interface ShapeErr {
  ok: false;
  message: string;
}
function shape(parsed: unknown, expectedQuestions: string[]): ShapeOk | ShapeErr {
  if (!isObj(parsed)) return { ok: false, message: "parsed not object" };
  const raw = parsed.items;
  if (!Array.isArray(raw)) return { ok: false, message: "items not array" };
  const items = raw
    .map((row, i) => {
      if (!isObj(row)) return null;
      const q = typeof row.question === "string" ? row.question.trim() : "";
      const a = typeof row.answer === "string" ? row.answer.trim() : "";
      if (!q || !a) return null;
      const conf: MemoConfidence | undefined =
        row.confidence === "high" || row.confidence === "medium" || row.confidence === "low"
          ? (row.confidence as MemoConfidence)
          : undefined;
      const srcArr = Array.isArray(row.sources) ? row.sources : [];
      const sources = srcArr
        .map((s) => {
          if (!isObj(s)) return null;
          const documentId = typeof s.documentId === "string" ? s.documentId : null;
          if (!documentId) return null;
          const page = typeof s.page === "number" ? s.page : undefined;
          const quote = typeof s.quote === "string" ? s.quote : undefined;
          return { documentId, page, quote } as {
            documentId: string;
            page?: number;
            quote?: string;
          };
        })
        .filter(
          (s): s is { documentId: string; page?: number; quote?: string } =>
            s !== null,
        );
      // Pair to the expected question by position so the model can't reorder.
      const question = expectedQuestions[i] ?? q;
      const item: PrioritiesAnswerItem = { question, answer: a };
      if (conf) item.confidence = conf;
      if (sources.length > 0) item.sources = sources;
      return item;
    })
    .filter((x): x is PrioritiesAnswerItem => x !== null);

  if (items.length === 0) return { ok: false, message: "no usable items" };
  return {
    ok: true,
    value: {
      generatedAt: new Date().toISOString(),
      items,
    },
  };
}
