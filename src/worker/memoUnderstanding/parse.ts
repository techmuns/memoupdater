import type {
  MemoUnderstanding,
  MemoUnderstandingClaimType,
  MemoUnderstandingFinancialClaim,
  MemoUnderstandingFlagCategory,
  MemoUnderstandingFlaggedDetail,
  MemoUnderstandingImportance,
  MemoUnderstandingResearchPriority,
  MemoUnderstandingResearchTask,
  MemoUnderstandingSegmentClaim,
  MemoUnderstandingSourcePriority,
  MemoUnderstandingThesisPillar,
} from "@shared/types";

// Phase 6A: strict shape validator for /api/memo/understand output.
// Mirrors the Phase 5E shape validators (parseSectionJson). After the
// schema enforces presence + types, this layer caps list lengths (defensive
// bounds — the model still occasionally overshoots) and validates id
// uniqueness.

// Phase 6A.1: compact-first reliability caps. Mirrors `maxItems` in
// schema.ts so the parser still enforces the bound even if the model
// returns extras.
const MAX_FLAGS = 5;
const MAX_PILLARS = 5;
const MAX_KEY_CLAIMS = 6;
const MAX_SEGMENT_CLAIMS = 4;
const MAX_TASKS = 8;
const MAX_LIST = 4;
const MAX_MUST_ANSWER = 6;

const FLAG_CATEGORIES = new Set<string>([
  "valuation_anchor",
  "financial_claim",
  "segment_driver",
  "margin_driver",
  "earnings_quality",
  "management_claim",
  "catalyst",
  "risk",
  "source_gap",
  "contradiction",
  "must_verify",
]);
const IMPORTANCES = new Set<string>(["critical", "high", "medium", "low"]);
const IMPORTANCES_3 = new Set<string>(["high", "medium", "low"]);
const PRIORITIES = new Set<string>(["must_check", "important", "nice_to_have"]);
const CLAIM_TYPES = new Set<string>([
  "reported",
  "forecast",
  "estimate",
  "guidance",
  "assumption",
]);
const SOURCE_PRIORITIES = new Set<string>([
  "company_filings",
  "exchange_filings",
  "earnings_call",
  "investor_presentation",
  "broker_notes",
  "market_data",
  "press",
]);

export type ParseUnderstandResult =
  | { ok: true; understanding: MemoUnderstanding }
  | { ok: false; code: "malformed_output"; message: string };

export function parseUnderstandJson(
  input: unknown,
  projectId: string,
): ParseUnderstandResult {
  if (!isPlainObject(input)) {
    return fail("Understanding output is not an object");
  }
  const u = input as Record<string, unknown>;

  // Top-level required keys.
  const requiredTop = [
    "projectId",
    "company",
    "memo",
    "summary",
    "flaggedDetails",
    "thesis",
    "financials",
    "valuation",
    "risksAndCatalysts",
    "researchPlan",
    "confidence",
  ];
  for (const k of requiredTop) {
    if (!(k in u)) return fail(`Missing required key: ${k}`);
  }

  const company = parseCompany(u.company);
  if (!company.ok) return company;
  const memo = parseMemo(u.memo);
  if (!memo.ok) return memo;
  const summary = parseSummary(u.summary);
  if (!summary.ok) return summary;
  const flaggedDetails = parseFlaggedDetails(u.flaggedDetails);
  if (!flaggedDetails.ok) return flaggedDetails;
  const thesis = parseThesis(u.thesis);
  if (!thesis.ok) return thesis;
  const financials = parseFinancials(u.financials);
  if (!financials.ok) return financials;
  const valuation = parseValuation(u.valuation);
  if (!valuation.ok) return valuation;
  const risksAndCatalysts = parseRisksAndCatalysts(u.risksAndCatalysts);
  if (!risksAndCatalysts.ok) return risksAndCatalysts;
  const researchPlan = parseResearchPlan(u.researchPlan);
  if (!researchPlan.ok) return researchPlan;
  const confidence = parseConfidence(u.confidence);
  if (!confidence.ok) return confidence;

  return {
    ok: true,
    understanding: {
      projectId,
      company: company.value,
      memo: memo.value,
      summary: summary.value,
      flaggedDetails: flaggedDetails.value,
      thesis: thesis.value,
      financials: financials.value,
      valuation: valuation.value,
      risksAndCatalysts: risksAndCatalysts.value,
      researchPlan: researchPlan.value,
      confidence: confidence.value,
    },
  };
}

// --- field-level parsers ---

function parseCompany(input: unknown): ParseResult<MemoUnderstanding["company"]> {
  if (!isPlainObject(input)) return fail("company missing");
  const detectedName = str(input.detectedName);
  if (!detectedName) return fail("company.detectedName missing");
  return ok({
    detectedName,
    normalizedName: optStr(input.normalizedName),
    ticker: optStr(input.ticker),
    aliases: strArr(input.aliases),
    sector: optStr(input.sector),
    geography: optStr(input.geography),
  });
}

function parseMemo(input: unknown): ParseResult<MemoUnderstanding["memo"]> {
  if (!isPlainObject(input)) return fail("memo missing");
  return ok({
    broker: optStr(input.broker),
    author: optStr(input.author),
    publishedDate: optStr(input.publishedDate),
    periodCovered: optStr(input.periodCovered),
    reportType: optStr(input.reportType),
    recommendation: optStr(input.recommendation),
    targetPrice: optStr(input.targetPrice),
    currentPriceAtMemo: optStr(input.currentPriceAtMemo),
    upsideAtMemo: optStr(input.upsideAtMemo),
    timeHorizon: optStr(input.timeHorizon),
  });
}

function parseSummary(input: unknown): ParseResult<MemoUnderstanding["summary"]> {
  if (!isPlainObject(input)) return fail("summary missing");
  return ok({
    oneLineSummary: str(input.oneLineSummary) ?? "",
    shortSummary: str(input.shortSummary) ?? "",
    originalThesis: str(input.originalThesis) ?? "",
    whatTheMemoNeedsToBeRight: strArr(input.whatTheMemoNeedsToBeRight, MAX_LIST),
    whatWouldChangeTheView: strArr(input.whatWouldChangeTheView, MAX_LIST),
  });
}

function parseFlaggedDetails(
  input: unknown,
): ParseResult<MemoUnderstandingFlaggedDetail[]> {
  if (!Array.isArray(input)) return fail("flaggedDetails must be an array");
  const out: MemoUnderstandingFlaggedDetail[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (out.length >= MAX_FLAGS) break;
    if (!isPlainObject(raw)) continue;
    const id = str(raw.id);
    const label = str(raw.label);
    const detail = str(raw.detail);
    const category = enumStr(raw.category, FLAG_CATEGORIES);
    const importance = enumStr(raw.importance, IMPORTANCES);
    const whyItMatters = str(raw.whyItMatters);
    const memoEvidence = str(raw.memoEvidence);
    const researchQuestion = str(raw.researchQuestion);
    if (
      !id ||
      seen.has(id) ||
      !label ||
      !detail ||
      !category ||
      !importance ||
      !whyItMatters ||
      !memoEvidence ||
      !researchQuestion
    ) {
      continue;
    }
    seen.add(id);
    out.push({
      id,
      label,
      detail,
      category: category as MemoUnderstandingFlagCategory,
      importance: importance as MemoUnderstandingImportance,
      whyItMatters,
      memoEvidence,
      researchQuestion,
    });
  }
  return ok(out);
}

function parseThesis(input: unknown): ParseResult<MemoUnderstanding["thesis"]> {
  if (!isPlainObject(input)) return fail("thesis missing");
  const pillars: MemoUnderstandingThesisPillar[] = [];
  const seen = new Set<string>();
  const rawPillars = Array.isArray(input.thesisPillars) ? input.thesisPillars : [];
  for (const raw of rawPillars) {
    if (pillars.length >= MAX_PILLARS) break;
    if (!isPlainObject(raw)) continue;
    const id = str(raw.id);
    const label = str(raw.label);
    const originalClaim = str(raw.originalClaim);
    const evidenceFromMemo = str(raw.evidenceFromMemo);
    const importance = enumStr(raw.importance, IMPORTANCES_3);
    const researchPriority = enumStr(raw.researchPriority, PRIORITIES);
    const needsResearch = typeof raw.needsResearch === "boolean" ? raw.needsResearch : false;
    if (
      !id ||
      seen.has(id) ||
      !label ||
      !originalClaim ||
      !evidenceFromMemo ||
      !importance ||
      !researchPriority
    ) {
      continue;
    }
    seen.add(id);
    pillars.push({
      id,
      label,
      originalClaim,
      evidenceFromMemo,
      importance: importance as "high" | "medium" | "low",
      needsResearch,
      researchPriority: researchPriority as MemoUnderstandingResearchPriority,
    });
  }
  return ok({
    oneLineThesis: str(input.oneLineThesis) ?? "",
    detailedThesis: str(input.detailedThesis) ?? "",
    thesisPillars: pillars,
  });
}

function parseFinancials(
  input: unknown,
): ParseResult<MemoUnderstanding["financials"]> {
  if (!isPlainObject(input)) return fail("financials missing");
  const keyClaims: MemoUnderstandingFinancialClaim[] = [];
  const seenClaims = new Set<string>();
  for (const raw of Array.isArray(input.keyClaims) ? input.keyClaims : []) {
    if (keyClaims.length >= MAX_KEY_CLAIMS) break;
    if (!isPlainObject(raw)) continue;
    const id = str(raw.id);
    const metric = str(raw.metric);
    const value = str(raw.value);
    const claimType = enumStr(raw.claimType, CLAIM_TYPES);
    const whyItMatters = str(raw.whyItMatters);
    const researchQuestion = str(raw.researchQuestion);
    if (
      !id ||
      seenClaims.has(id) ||
      !metric ||
      !value ||
      !claimType ||
      !whyItMatters ||
      !researchQuestion
    ) {
      continue;
    }
    seenClaims.add(id);
    keyClaims.push({
      id,
      metric,
      value,
      period: optStr(raw.period),
      segment: optStr(raw.segment),
      claimType: claimType as MemoUnderstandingClaimType,
      whyItMatters,
      researchQuestion,
    });
  }
  const segmentClaims: MemoUnderstandingSegmentClaim[] = [];
  const seenSeg = new Set<string>();
  for (const raw of Array.isArray(input.segmentClaims) ? input.segmentClaims : []) {
    if (segmentClaims.length >= MAX_SEGMENT_CLAIMS) break;
    if (!isPlainObject(raw)) continue;
    const id = str(raw.id);
    const segment = str(raw.segment);
    const claim = str(raw.claim);
    const importance = enumStr(raw.importance, IMPORTANCES_3);
    const researchQuestion = str(raw.researchQuestion);
    if (!id || seenSeg.has(id) || !segment || !claim || !importance || !researchQuestion) {
      continue;
    }
    seenSeg.add(id);
    segmentClaims.push({
      id,
      segment,
      claim,
      metric: optStr(raw.metric),
      value: optStr(raw.value),
      period: optStr(raw.period),
      importance: importance as "high" | "medium" | "low",
      researchQuestion,
    });
  }
  return ok({ keyClaims, segmentClaims });
}

function parseValuation(
  input: unknown,
): ParseResult<MemoUnderstanding["valuation"]> {
  if (!isPlainObject(input)) return fail("valuation missing");
  return ok({
    method: optStr(input.method),
    targetMultiple: optStr(input.targetMultiple),
    targetMetric: optStr(input.targetMetric),
    impliedEPS: optStr(input.impliedEPS),
    targetPrice: optStr(input.targetPrice),
    upside: optStr(input.upside),
    keyValuationAssumptions: strArr(input.keyValuationAssumptions, MAX_LIST),
    valuationQuestionsToUpdate: strArr(input.valuationQuestionsToUpdate, MAX_LIST),
  });
}

function parseRisksAndCatalysts(
  input: unknown,
): ParseResult<MemoUnderstanding["risksAndCatalysts"]> {
  if (!isPlainObject(input)) return fail("risksAndCatalysts missing");
  return ok({
    catalysts: strArr(input.catalysts, MAX_LIST),
    risks: strArr(input.risks, MAX_LIST),
    watchItems: strArr(input.watchItems, MAX_LIST),
  });
}

function parseResearchPlan(
  input: unknown,
): ParseResult<MemoUnderstanding["researchPlan"]> {
  if (!isPlainObject(input)) return fail("researchPlan missing");
  const tasks: MemoUnderstandingResearchTask[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(input.researchTasks) ? input.researchTasks : []) {
    if (tasks.length >= MAX_TASKS) break;
    if (!isPlainObject(raw)) continue;
    const id = str(raw.id);
    const label = str(raw.label);
    const question = str(raw.question);
    const memoAnchor = str(raw.memoAnchor);
    const expectedEvidence = str(raw.expectedEvidence);
    const priority = enumStr(raw.priority, PRIORITIES);
    if (
      !id ||
      seen.has(id) ||
      !label ||
      !question ||
      !memoAnchor ||
      !expectedEvidence ||
      !priority
    ) {
      continue;
    }
    const preferred = enumStrArr(raw.preferredSources, SOURCE_PRIORITIES) as
      MemoUnderstandingSourcePriority[];
    seen.add(id);
    tasks.push({
      id,
      label,
      question,
      memoAnchor,
      linkedFlagIds: strArr(raw.linkedFlagIds),
      linkedPillarIds: strArr(raw.linkedPillarIds),
      linkedFinancialClaimIds: strArr(raw.linkedFinancialClaimIds),
      preferredSources: preferred,
      expectedEvidence,
      priority: priority as MemoUnderstandingResearchPriority,
    });
  }
  return ok({
    mustAnswerQuestions: strArr(input.mustAnswerQuestions, MAX_MUST_ANSWER),
    sourcePriorities: enumStrArr(input.sourcePriorities, SOURCE_PRIORITIES) as
      MemoUnderstandingSourcePriority[],
    researchTasks: tasks,
  });
}

function parseConfidence(
  input: unknown,
): ParseResult<MemoUnderstanding["confidence"]> {
  if (!isPlainObject(input)) return fail("confidence missing");
  const extractionConfidence = enumStr(input.extractionConfidence, IMPORTANCES_3);
  return ok({
    extractionConfidence: (extractionConfidence as "high" | "medium" | "low") ?? "low",
    missingFromMemo: strArr(input.missingFromMemo, MAX_LIST),
    ambiguousItems: strArr(input.ambiguousItems, MAX_LIST),
  });
}

// --- value coercion helpers ---

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function optStr(v: unknown): string | undefined {
  return str(v);
}

function strArr(v: unknown, max?: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (max !== undefined && out.length >= max) break;
    const s = str(x);
    if (s) out.push(s);
  }
  return out;
}

function enumStr(v: unknown, set: Set<string>): string | undefined {
  const s = str(v);
  return s && set.has(s) ? s : undefined;
}

function enumStrArr(v: unknown, set: Set<string>): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    const s = enumStr(x, set);
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "malformed_output"; message: string };

function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

function fail(message: string): {
  ok: false;
  code: "malformed_output";
  message: string;
} {
  return { ok: false, code: "malformed_output", message };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
