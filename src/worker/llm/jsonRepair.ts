import type {
  CanonicalSectionId,
  LlmGenerationWarning,
  MemoSection,
} from "@shared/types";
import { callOpenAIResponses } from "./openai";
import { parseSectionJson } from "./parse";
import { normalizeSectionNulls } from "./sectionSchema";
import { trimToCharBudget } from "./trim";

// Phase 5F: structured-output reliability for /api/generate/memo-section.
//
// Two helpers:
//   - extractFirstJsonObject(text): a PURE tolerator that strips common
//     prose wrappers (code fences, leading preface, trailing notes) and
//     locates the first balanced `{...}` object so the strict
//     parseSectionJson layer can run unchanged. NEVER edits content;
//     NEVER fabricates fields.
//   - runSectionRepair(args): a SINGLE focused OpenAI call that asks
//     the model to convert a malformed/truncated draft into a valid
//     MemoSection JSON object that matches the strict schema. No
//     web_search, no tools, low max tokens. Used only after
//     extractFirstJsonObject also fails — never as the first attempt.
//
// Logging discipline: NEVER log raw output text, memo content, source
// text, source URLs, the API key, or any user payload. Callers in the
// section endpoint log only counts (rawLength, sectionId,
// extractFallbackUsed, repairAttempted, token counts).

export type ExtractJsonResult =
  | { ok: true; value: unknown; usedFallback: boolean }
  | { ok: false; reason: string };

const FENCE_RE = /^```(?:[a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)\n?```\s*$/;

export function extractFirstJsonObject(input: unknown): ExtractJsonResult {
  if (typeof input !== "string") {
    return { ok: false, reason: "input is not a string" };
  }
  let text = input.trim();
  if (text.length === 0) {
    return { ok: false, reason: "input is empty" };
  }
  const fenced = FENCE_RE.exec(text);
  if (fenced && fenced[1]) {
    text = fenced[1].trim();
  }
  // Fast path: the entire (trimmed, fence-stripped) text IS valid JSON.
  const fastValue = tryParseObject(text);
  if (fastValue !== undefined) {
    return { ok: true, value: fastValue, usedFallback: false };
  }
  // Slow path: scan for the first balanced { ... } object. Skip braces
  // inside strings (with backslash-escape handling).
  for (let start = text.indexOf("{"); start !== -1; start = text.indexOf("{", start + 1)) {
    const end = findBalancedObjectEnd(text, start);
    if (end === -1) continue;
    const slice = text.slice(start, end + 1);
    const value = tryParseObject(slice);
    if (value !== undefined) {
      return { ok: true, value, usedFallback: true };
    }
  }
  return { ok: false, reason: "no balanced JSON object parsed" };
}

function tryParseObject(slice: string): unknown {
  try {
    const v = JSON.parse(slice);
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      return v;
    }
  } catch {
    // fall through
  }
  return undefined;
}

function findBalancedObjectEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
      if (depth < 0) return -1;
    }
  }
  return -1;
}

// ---- Repair pass ----

export type ProviderFailCodeForRepair =
  | "llm_error"
  | "timeout"
  | "malformed_output"
  | "rate_limited"
  | "not_configured";

export interface RunSectionRepairArgs {
  apiKey: string;
  model: string;
  sectionId: CanonicalSectionId;
  rawText: string;
  schema: object;
  schemaName: string;
  maxTokens?: number;
  abortSignal?: AbortSignal;
}

export type RunSectionRepairResult =
  | {
      ok: true;
      parsed: unknown;
      inputTokens?: number;
      outputTokens?: number;
    }
  | {
      ok: false;
      code: ProviderFailCodeForRepair;
      message: string;
    };

const REPAIR_INPUT_CHAR_BUDGET = 6_000;
// The repair re-emits the SAME full MemoSection schema, so its ceiling must
// be at least as large as the biggest primary section ceiling — otherwise it
// truncates exactly where the primary did and can never recover (the same
// trap the memo-understanding repair tier hit at 1,600). Reasoning effort
// defaults to "low" via callOpenAIResponses, so this is headroom, not spend.
const REPAIR_MAX_OUTPUT_TOKENS = 4_000;

export async function runSectionRepair(
  args: RunSectionRepairArgs,
): Promise<RunSectionRepairResult> {
  const trimmed = trimToCharBudget(args.rawText, REPAIR_INPUT_CHAR_BUDGET);
  const system = [
    `You are a JSON repair assistant. Convert the user-supplied draft into a single valid JSON object that exactly matches the MemoSection schema for section "${args.sectionId}".`,
    "Preserve every fact present in the draft — numbers, dates, source URLs, document ids, tier labels, and quoted text.",
    "Do NOT add new facts. Do NOT change meaning. Do NOT invent sources, numbers, or quotes.",
    "If the draft is truncated mid-array or mid-string, OMIT the incomplete tail rather than invent a completion.",
    "For fields the draft omits entirely, use sensible empty values: empty array for `bullets` / `sources` / `bridge`, empty string for short text fields, and `null` for `confidence` / `confidenceNote` / `bridge` if no draft value exists.",
    "Emit a SINGLE JSON object. No prose outside the JSON. No code fences.",
  ].join("\n");
  const user = [
    `Section id: ${args.sectionId}`,
    "",
    "Draft (may be truncated or wrapped in prose):",
    "```text",
    trimmed,
    "```",
    "",
    "Emit one valid JSON object matching the schema.",
  ].join("\n");

  const call = await callOpenAIResponses({
    apiKey: args.apiKey,
    model: args.model,
    system,
    user,
    schema: args.schema,
    schemaName: args.schemaName,
    maxTokens: args.maxTokens ?? REPAIR_MAX_OUTPUT_TOKENS,
    abortSignal: args.abortSignal,
    logEventTag: "llm_section_repair",
  });

  if (!call.ok) {
    return { ok: false, code: call.code, message: call.message };
  }
  return {
    ok: true,
    parsed: call.parsed,
    inputTokens: call.inputTokens,
    outputTokens: call.outputTokens,
  };
}

// ---- Extract → Repair ladder (pure, injectable) ----
//
// Pulled out of the worker section handler so it can be exercised by
// synthetic tests with mock call fns (no real OpenAI). The ladder:
//   1. If the normal call succeeded, parse + return success.
//   2. If it failed with malformed_output AND rawText is present:
//      a. Try extractFirstJsonObject + parseSectionJson.
//      b. If that fails, call the repair fn ONCE and try parseSectionJson
//         on its output.
//      c. If both fail, return parse_error.
//   3. Any other failure code (timeout/rate_limited/provider_error/...)
//      passes through unchanged.

export interface SectionCallSuccess {
  ok: true;
  parsed: unknown;
  inputTokens?: number;
  outputTokens?: number;
}

export interface SectionCallFailure {
  ok: false;
  code: ProviderFailCodeForRepair;
  message: string;
  rawText?: string;
}

export type SectionCallResult = SectionCallSuccess | SectionCallFailure;

export type SectionCallFn = () => Promise<SectionCallResult>;
export type SectionRepairFn = (rawText: string) => Promise<SectionCallResult>;

export interface SectionLadderArgs {
  sectionId: CanonicalSectionId;
  allowedDocumentIds: Set<string>;
  normalCall: SectionCallFn;
  repairCall: SectionRepairFn;
  log?: (event: {
    sectionId: CanonicalSectionId;
    rawLength: number;
    extractFallbackUsed: boolean;
    repairAttempted: boolean;
    repairOk: boolean;
  }) => void;
}

export type SectionLadderResult =
  | {
      ok: true;
      section: MemoSection;
      warnings: LlmGenerationWarning[];
      inputTokens?: number;
      outputTokens?: number;
      extractFallbackUsed: boolean;
      repairAttempted: boolean;
    }
  | {
      ok: false;
      code: ProviderFailCodeForRepair | "parse_error";
      message: string;
    };

export async function runSectionExtractRepairLadder(
  args: SectionLadderArgs,
): Promise<SectionLadderResult> {
  const result = await args.normalCall();

  if (result.ok) {
    return finalizeParse(
      result.parsed,
      args,
      result.inputTokens,
      result.outputTokens,
      false,
      false,
    );
  }

  if (result.code !== "malformed_output" || typeof result.rawText !== "string") {
    return { ok: false, code: result.code, message: result.message };
  }

  const rawLength = result.rawText.length;
  let resolved: { parsed: unknown; inputTokens?: number; outputTokens?: number } | null = null;
  let extractFallbackUsed = false;
  let repairAttempted = false;

  const extracted = extractFirstJsonObject(result.rawText);
  if (extracted.ok) {
    const candidate = normalizeSectionNulls(extracted.value);
    const tryParse = parseSectionJson(candidate, args.sectionId, args.allowedDocumentIds);
    if (tryParse.ok) {
      resolved = { parsed: candidate };
      extractFallbackUsed = true;
    }
  }

  if (!resolved) {
    repairAttempted = true;
    const repair = await args.repairCall(result.rawText);
    if (repair.ok) {
      resolved = {
        parsed: repair.parsed,
        inputTokens: repair.inputTokens,
        outputTokens: repair.outputTokens,
      };
    }
  }

  args.log?.({
    sectionId: args.sectionId,
    rawLength,
    extractFallbackUsed,
    repairAttempted,
    repairOk: Boolean(resolved && repairAttempted),
  });

  if (!resolved) {
    return {
      ok: false,
      code: "parse_error" as const,
      message: "Provider output_text was not valid JSON (extract + repair both failed).",
    };
  }

  return finalizeParse(
    resolved.parsed,
    args,
    resolved.inputTokens,
    resolved.outputTokens,
    extractFallbackUsed,
    repairAttempted,
  );
}

function finalizeParse(
  parsedJson: unknown,
  args: SectionLadderArgs,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
  extractFallbackUsed: boolean,
  repairAttempted: boolean,
): SectionLadderResult {
  const normalized = normalizeSectionNulls(parsedJson);
  const parsedSection = parseSectionJson(
    normalized,
    args.sectionId,
    args.allowedDocumentIds,
  );
  if (!parsedSection.ok) {
    return {
      ok: false,
      code: "parse_error" as const,
      message: parsedSection.message,
    };
  }
  return {
    ok: true,
    section: parsedSection.section,
    warnings: parsedSection.warnings,
    inputTokens,
    outputTokens,
    extractFallbackUsed,
    repairAttempted,
  };
}
