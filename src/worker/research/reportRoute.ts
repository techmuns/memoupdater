// POST /api/research/report-section — one web-grounded section of the
// comprehensive research report. Mirrors the discipline of the per-pass
// research route (OpenAI-only, gate-checked, web_search grounded, 200-with-
// safe-failure on any error) but returns Markdown prose + sources instead of
// structured findings.
//
// NEVER logged: memo text, prompts, source quotes, the API key, or c.env.
import type { Context } from "hono";
import type {
  LlmProviderName,
  ReportSource,
  ResearchErrorCode,
  ResearchReportSectionId,
  ResearchReportSectionRequest,
  ResearchReportSectionResponse,
} from "@shared/types";
import { RESEARCH_REPORT_SECTION_TITLES } from "@shared/researchReport";
import {
  checkGateToken,
  evaluateLlmReadiness,
  getProviderName,
} from "../llm/provider";
import {
  callOpenAIResponses,
  defaultReasoningEffort,
  harvestWebSources,
} from "../llm/openai";
import {
  RESEARCH_REPORT_SECTION_IDS,
  buildReportSectionPrompt,
} from "./reportPrompt";
import {
  REPORT_SECTION_FORMAT_NAME,
  REPORT_SECTION_OPENAI_SCHEMA,
  coerceReportSection,
} from "./reportSchema";

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const REPORT_MAX_OUTPUT_TOKENS = 9_000;
const REPORT_COMPACT_MAX_OUTPUT_TOKENS = 5_000;
const REPORT_TIMEOUT_MS = 92_000;
const REPORT_COMPACT_TIMEOUT_MS = 85_000;
const GATE_HEADER = "x-memo-llm-gate";

const WEB_SEARCH_TOOL = { type: "web_search" } as const;
const WEB_SEARCH_TOOL_CHOICE = { type: "web_search" } as const;
const REPORT_INCLUDE = ["web_search_call.action.sources"] as const;

export async function handleResearchReportSection(
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
  const validation = validateRequest(parsed);
  if (!validation.ok) {
    return c.json({ error: "invalid_request", message: validation.message }, 400);
  }
  const req = validation.value;
  const section = req.section;

  const readiness = evaluateLlmReadiness(c.env);
  if (!readiness.llmEnabled) {
    return c.json(fail("not_configured", "LLM research is not enabled on this server.", section));
  }
  if (!readiness.providerConfigured) {
    return c.json(fail("provider_missing", "LLM provider is not configured.", section, readiness.provider, readiness.model));
  }
  if (readiness.provider !== "openai") {
    return c.json(fail("research_unavailable", "Research requires the OpenAI provider.", section, readiness.provider, readiness.model));
  }
  if (!readiness.apiKeyConfigured) {
    return c.json(fail("api_key_missing", "LLM API key is not configured.", section, readiness.provider, readiness.model));
  }
  if (readiness.gateEnabled) {
    const gate = checkGateToken(c.env, c.req.header(GATE_HEADER));
    if (!gate.ok) {
      return c.json(fail(gate.code, gate.message, section, readiness.provider, readiness.model));
    }
  }
  if (getProviderName(c.env) !== "openai") {
    return c.json(fail("research_unavailable", "Research provider unavailable.", section, readiness.provider, readiness.model));
  }
  const apiKey = readResolvedApiKey(c.env);
  if (!apiKey || !readiness.model) {
    return c.json(fail("not_configured", "Research provider is not available.", section, readiness.provider, readiness.model));
  }

  try {
    const prompt = buildReportSectionPrompt(req);
    const maxTokens = req.retryCompact ? REPORT_COMPACT_MAX_OUTPUT_TOKENS : REPORT_MAX_OUTPUT_TOKENS;
    const timeoutMs = req.retryCompact ? REPORT_COMPACT_TIMEOUT_MS : REPORT_TIMEOUT_MS;

    console.log(
      JSON.stringify({
        event: "llm_report_section_enter",
        section,
        retryCompact: req.retryCompact === true,
        systemLen: prompt.system.length,
        userLen: prompt.user.length,
        maxTokens,
        model: readiness.model,
      }),
    );

    const call = await callOpenAIResponses({
      apiKey,
      model: readiness.model,
      system: prompt.system,
      user: prompt.user,
      schema: REPORT_SECTION_OPENAI_SCHEMA as unknown as Record<string, unknown>,
      schemaName: REPORT_SECTION_FORMAT_NAME,
      tools: [WEB_SEARCH_TOOL as unknown as Record<string, unknown>],
      toolChoice: WEB_SEARCH_TOOL_CHOICE,
      include: [...REPORT_INCLUDE],
      maxTokens,
      timeoutMs,
      reasoningEffort: defaultReasoningEffort(readiness.model),
      abortSignal: c.req.raw.signal,
      logEventTag: "llm_report_section",
    });

    if (!call.ok) {
      return c.json(fail(translateCode(call.code), call.message, section, readiness.provider, readiness.model));
    }

    const coerced = coerceReportSection(call.parsed);
    if (!coerced) {
      return c.json(fail("parse_error", "Report section returned malformed or empty content.", section, readiness.provider, readiness.model));
    }

    // Merge model-emitted sources with the web_search citations the tool
    // actually returned, so the section is grounded in real URLs.
    const harvested = harvestWebSources(call.payload);
    const sources = mergeSources(coerced.sources, harvested);

    console.log(
      JSON.stringify({
        event: "llm_report_section_sources",
        section,
        webSearchCallCount: harvested.webSearchCallCount,
        urlCitationCount: harvested.urlCitationCount,
        mergedSources: sources.length,
        markdownLen: coerced.markdown.length,
      }),
    );

    const body: ResearchReportSectionResponse = {
      ok: true,
      section,
      markdown: coerced.markdown,
      sources,
      notDisclosed: coerced.notDisclosed,
      providerMetadata: {
        providerName: "openai",
        modelUsed: readiness.model,
        inputTokens: call.inputTokens,
        outputTokens: call.outputTokens,
      },
    };
    return c.json(body);
  } catch {
    console.log(JSON.stringify({ event: "llm_report_section_unexpected_fail", section, model: readiness.model }));
    return c.json(fail("provider_error", "Internal report-section error.", section, readiness.provider, readiness.model));
  }
}

function mergeSources(
  modelSources: { url: string; title?: string; date?: string }[],
  harvested: ReturnType<typeof harvestWebSources>,
): ReportSource[] {
  const byUrl = new Map<string, ReportSource>();
  for (const [url, meta] of harvested.byUrl.entries()) {
    byUrl.set(url, { url, title: meta.title, date: meta.date });
  }
  for (const s of modelSources) {
    if (!byUrl.has(s.url)) {
      byUrl.set(s.url, { url: s.url, title: s.title, date: s.date });
    }
  }
  return [...byUrl.values()].slice(0, 24);
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

function fail(
  code: ResearchErrorCode,
  message: string,
  section: ResearchReportSectionId,
  providerName?: LlmProviderName,
  modelUsed?: string,
): ResearchReportSectionResponse {
  return { ok: false, section, code, message, providerName, modelUsed };
}

function translateCode(
  code: "llm_error" | "timeout" | "malformed_output" | "rate_limited" | "not_configured",
): ResearchErrorCode {
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
  | { ok: true; value: ResearchReportSectionRequest }
  | { ok: false; message: string };

function validateRequest(input: unknown): ValidationResult {
  if (!isPlainObject(input)) return { ok: false, message: "request must be an object" };
  const section = input.section;
  if (typeof section !== "string" || !(RESEARCH_REPORT_SECTION_IDS as readonly string[]).includes(section)) {
    return { ok: false, message: `section is not a canonical report section id: ${String(section)}` };
  }
  const project = input.project;
  if (!isPlainObject(project) || typeof project.id !== "string" || typeof project.companyName !== "string") {
    return { ok: false, message: "project.id / project.companyName missing" };
  }
  const aliases = input.companyAliases;
  if (!isPlainObject(aliases) || typeof aliases.longName !== "string" || aliases.longName.length === 0) {
    return { ok: false, message: "companyAliases.longName missing" };
  }
  const detection = input.detection;
  if (!isPlainObject(detection) || typeof detection.periodLabel !== "string" || typeof detection.researchCurrent !== "string") {
    return { ok: false, message: "detection.periodLabel / detection.researchCurrent missing" };
  }
  // Title is server-authoritative; ignore any client-supplied title.
  void RESEARCH_REPORT_SECTION_TITLES;
  return { ok: true, value: input as unknown as ResearchReportSectionRequest };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
