export type MemoProjectStatus = "demo" | "draft" | "active" | "archived";

export type DocumentKind =
  | "initial_memo"
  | "financials"
  | "management_commentary"
  | "broker_notes"
  | "competitor_notes"
  | "macro_notes"
  | "market_data";

export interface UploadedDocument {
  id: string;
  projectId: string;
  kind: DocumentKind;
  filename: string;
  sizeBytes: number;
  isDemo: boolean;
  uploadedAt: string;
}

export interface MemoProject {
  id: string;
  ticker: string;
  companyName: string;
  sector: string;
  status: MemoProjectStatus;
  createdAt: string;
  updatedAt: string;
  uploads: UploadedDocument[];
}

export interface SourceReference {
  documentId: string;
  page?: number;
  quote?: string;
}

export interface ThesisCheckpoint {
  id: string;
  label: string;
  expectedDirection: "up" | "down" | "flat";
  rationale: string;
  sources: SourceReference[];
}

export interface MemoDNA {
  projectId: string;
  originalThesis: string;
  keyAssumptions: string[];
  styleTone: {
    adjectives: string[];
    sampleSentences: string[];
  };
  analyticalFramework: string[];
  valuationFramework: {
    method: string;
    targetMultiple: string;
    bridgeNotes: string[];
  };
  openQuestions: string[];
  riskChecklist: {
    category: string;
    risks: string[];
  }[];
  thesisCheckpoints: ThesisCheckpoint[];
  isDemo: boolean;
}

export interface UpdatePack {
  projectId: string;
  financials?: UploadedDocument;
  commentary?: UploadedDocument;
  brokerNotes?: UploadedDocument[];
  competitorNotes?: UploadedDocument[];
  macroNotes?: UploadedDocument[];
  marketData?: UploadedDocument[];
}

// Forward declaration so MemoSection.signal resolves textually as well as via TS hoisting.
export type MemoSectionSignal = "positive" | "neutral" | "negative" | "watch";

// Phase 5B: per-section confidence label. Drives the confidence pill in
// MemoReview and the inline "confidence: X" tag in the Markdown copy.
export type MemoConfidence = "high" | "medium" | "low";

// Phase 5B: compact bridge row for financial / EPS / valuation sections.
// All optional except `metric` so the model can leave a column blank
// rather than invent a value.
export interface FinancialBridgeRow {
  metric: string;
  original?: string;
  latest?: string;
  readThrough?: string;
}

export interface MemoSection {
  id: string;
  title: string;
  body: string;
  sources: SourceReference[];
  summary?: string;
  bullets?: string[];
  signal?: MemoSectionSignal;
  confidenceNote?: string;
  confidence?: MemoConfidence;
  bridge?: FinancialBridgeRow[];
}

export interface FollowUpMemo {
  projectId: string;
  title: string;
  generatedAt: string;
  // Phase 6B: the CORE memo body — six sec_* sections printed in the
  // <3-page memo. The renderer (MemoReview) shows these as the memo.
  sections: MemoSection[];
  // Phase 6B: supplementary sup_* panels (Valuation Detail, EPS Bridge,
  // Memo-vs-Actual Financials). Rendered as collapsible drawers BELOW
  // the memo so the printed memo body stays under three pages.
  supplementaryPanels?: MemoSection[];
  isDemo: boolean;
  // Single sink for residual manual-check items, rendered once at the
  // foot of the memo. Replaces per-section "Needs manual verification."
  manualChecksRemaining?: string[];
  // Phase 5C: tag the build path. "llm" = OpenAI generation, "demo" =
  // fixture, "deterministic" = client-side fallback built from research
  // findings. UI uses this to render the fallback banner.
  sourceMode?: FollowUpMemoSourceMode;
}

export type GenerationStepStatus = "not_started" | "ready" | "demo_generated";

export interface GenerationStep {
  id: string;
  label: string;
  description: string;
  status: GenerationStepStatus;
}

export type GenerationRunStatus =
  | "not_started"
  | "ready"
  | "demo_generated"
  | "running"
  | "complete"
  | "failed";

export interface GenerationRun {
  id: string;
  projectId: string;
  status: GenerationRunStatus;
  steps: GenerationStep[];
  startedAt?: string;
  completedAt?: string;
}

export interface HealthResponse {
  status: "ok";
  phase: "1-demo";
  timestamp: string;
}

// Phase 6H: build-version handshake. The client compares its compiled-in
// APP_BUILD_ID against this to detect a stale browser tab talking to a
// freshly-deployed worker.
export interface VersionResponse {
  buildId: string;
}

// ---------- Phase 2 additions ----------

export type MemoAnalysisMode = "demo" | "extracted";

export type ExtractionStatus =
  | "idle"
  | "extracting"
  | "success"
  | "partial"
  | "unsupported"
  | "error";

export interface ExtractionResult {
  status: ExtractionStatus;
  text: string;
  characterCount: number;
  wordCount: number;
  pageCount?: number;
  warnings: string[];
  errorMessage?: string;
  source: {
    filename: string;
    sizeBytes: number;
    mime: string;
    extension: string;
  };
  extractedAt: string;
}

export interface LocalUploadedFile {
  id: string;
  kind: DocumentKind;
  filename: string;
  sizeBytes: number;
  mime: string;
  extension: string;
  uploadedAt: string;
  extractionSupported: boolean;
}

export interface KeywordSignal {
  phrase: string;
  category: string;
  weight: number;
  hits: number;
}

export interface StyleSignal {
  avgSentenceLength: number;
  firstPersonRatio: number;
  hedgeRatio: number;
  bulletDensity: number;
  numericalDensity: number;
}

// ---------- Phase 3 additions ----------

export type SignalPolarity = "positive" | "negative" | "neutral";

export type UpdateSignalCategory =
  | "financial_growth"
  | "margin"
  | "guidance"
  | "management"
  | "ma_integration"
  | "recurring_quality"
  | "valuation"
  | "ai_macro_competitive"
  | "unresolved_question";

export interface DocumentSourceSnippet {
  documentId: string;
  kind: DocumentKind;
  quote: string;
  page?: number;
}

export interface UpdateSignal {
  id: string;
  category: UpdateSignalCategory;
  polarity: SignalPolarity;
  phrase: string;
  weight: number;
  documentKind: DocumentKind;
  source: DocumentSourceSnippet;
}

export interface UpdatePackAnalysis {
  signals: UpdateSignal[];
  byCategory: Partial<Record<UpdateSignalCategory, UpdateSignal[]>>;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  netPolarityScore: number;
  documentsAnalyzed: DocumentKind[];
  unsupportedDocuments: DocumentKind[];
}

export type GeneratedMemoStatus =
  | "missing_initial_memo"
  | "missing_update_pack"
  | "ready"
  | "generated";

export interface FollowUpMemoGenerationInput {
  dna: MemoDNA;
  analysis: UpdatePackAnalysis;
  uploads: Partial<Record<DocumentKind, LocalUploadedFile>>;
  generatedAt: string;
}

export interface FollowUpMemoGenerationResult {
  memo: FollowUpMemo;
  analysis: UpdatePackAnalysis;
  overallSignal: MemoSectionSignal;
  warnings: string[];
}

// ---------- Phase 4A additions: LLM follow-up memo generation ----------

export type LlmProviderName = "anthropic" | "openai" | "none";

export interface LlmProviderMetadata {
  providerName: LlmProviderName;
  modelUsed: string;
  inputTokens?: number;
  outputTokens?: number;
}

export type ApiKeySource = "LLM_API_KEY" | "OPENAI_API_KEY" | "none";

export interface LlmStatusResponse {
  llmEnabled: boolean;
  providerConfigured: boolean;
  apiKeyConfigured: boolean;
  apiKeySource?: ApiKeySource;
  provider?: LlmProviderName;
  model?: string;
  gateEnabled: boolean;
  gateConfigured: boolean;
  llmReady: boolean;
  researchAvailable?: boolean;
  fallbackAvailable: true;
  warnings: string[];
}

export interface GenerateFollowUpMemoUpdateDoc {
  id: string;
  kind: DocumentKind;
  filename: string;
  text: string;
}

export interface GenerateFollowUpMemoRequest {
  project: {
    id: string;
    ticker: string;
    companyName: string;
    sector?: string;
  };
  initialMemo: {
    id?: string;
    text: string;
    sourceFilename: string;
    sizeBytes: number;
  };
  updateDocs?: GenerateFollowUpMemoUpdateDoc[];
  dna: MemoDNA;
  analysis?: UpdatePackAnalysis;
  research?: ResearchFindings | null;
  detection?: ResearchDetectionInput;
  generationOptions?: {
    maxTokens?: number;
    // Phase 5C: when true, the worker uses trimRequestBodyCompact (8k
    // initial memo, 12 findings, 4 sources/finding, etc.) and clamps the
    // max output tokens to a lower ceiling. The worker also auto-trips
    // this branch pre-call when the assembled default prompt exceeds the
    // safe size threshold — see worker/index.ts.
    compact?: boolean;
  };
}

// ---------- Phase 5 additions: period detection + OpenAI research ----------

export type DetectedPeriodKind =
  | "iso_date"
  | "month_year"
  | "quarter_fy"
  | "fiscal_year"
  | "phrase";

export interface DetectedPeriod {
  rawMatch: string;
  kind: DetectedPeriodKind;
  isoDate?: string;
  isoMonth?: string;
  monthLabel?: string;
  quarter?: "Q1" | "Q2" | "Q3" | "Q4";
  fiscalYearLabel?: string;
  fiscalYearNumber?: number;
}

export type DetectionConfidence = "high" | "medium" | "low";

export interface PeriodDetectionResult {
  detectedCompany?: string;
  candidates: DetectedPeriod[];
  best?: DetectedPeriod;
  researchStart?: string;
  researchCurrent: string;
  confidence: DetectionConfidence;
  assumptionNotes: string[];
  // Phase 5C: ticker pulled from "HAVL IN", "NSE: HAVELLS", "Ticker: …"
  // etc. — used as a trailing chip in the header + as a tiebreaker for
  // company detection. Confidence + reason are populated by the
  // company-detection heuristic so the PeriodPanel can prompt the user
  // to confirm when the detector isn't sure.
  detectedTicker?: string;
  companyDetectionConfidence?: DetectionConfidence;
  companyDetectionReason?: string;
  // ISO YYYY-MM-DD of the memo's WRITTEN-ON date — extracted deterministically
  // from the memo text by `detectMemoWrittenOn` (regex over named/anchored/
  // numeric date forms). Drives the holding-period for return computations.
  memoWrittenOn?: string;
  memoWrittenOnRaw?: string;
  memoWrittenOnConfidence?: DetectionConfidence;
  memoWrittenOnReason?: string;
}

export interface ResearchDetectionInput {
  detectedCompany?: string;
  periodLabel: string;
  researchStart?: string;
  researchCurrent: string;
  assumptionNotes?: string[];
  // The memo's written-on date (ISO YYYY-MM-DD) — deterministic regex pick
  // from the extracted text. Drives return-attribution math (today − written
  // ⇒ holding period for CAGR / index-relative return) and the section
  // headline ("stock +X% over Y months since the memo").
  memoWrittenOn?: string;
  // Server-fetched live quote for the selected company, injected by the
  // memo-generation orchestrator just before research/section calls. When
  // present, the model uses this VERBATIM as the current price and does NOT
  // search for an alternative. Absent => model falls back to its own search.
  currentPrice?: CurrentPriceInput;
}

export interface CurrentPriceInput {
  value: number;          // raw numeric price as quoted
  currency: string;       // ISO-ish, e.g. "INR", "USD"
  asOf: string;           // ISO date the quote was fetched
  source: string;         // human label, e.g. "Yahoo Finance · RATEGAIN.NS"
  display: string;        // pre-formatted, e.g. "Rs 871.45 (as of 2026-06-19, Yahoo Finance)"
  // Optional CURRENT fundamentals that the same upstream returned alongside
  // the price. The section prompt uses these verbatim — never re-searched.
  // Forward fields intentionally absent: the memo does NOT include forward
  // valuations (analyst principle — only sourced current metrics vs the
  // memo-date anchors).
  trailingEps?: number;
  trailingPE?: number;
  marketCap?: number;
  enterpriseValue?: number;
  trailingEvToEbitda?: number;
  priceToBook?: number;
  bookValue?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fundamentalsDisplay?: string;
}

export type ResearchFindingCategory =
  | "financials"
  | "management"
  | "filings"
  | "guidance"
  | "broker_consensus"
  | "valuation"
  | "peers"
  | "macro"
  | "ai_tech_risk"
  | "other";

export type ResearchFindingImpact = "positive" | "negative" | "neutral" | "watch";

// Phase 5B: source-priority tier. The research prompt instructs the
// model to label each source; the worker validator then runs a
// conservative URL/title-based override that only ever DOWNGRADES the
// model's tier (server never upgrades a press source to official). The
// memo prompt and the UI consume this single normalized value.
export type SourceTier =
  | "official"
  | "company"
  | "exchange"
  | "transcript"
  | "press"
  | "market_data"
  | "other";

export interface ResearchSource {
  title: string;
  url: string;
  date?: string;
  note?: string;
  verifiedByWebSearch?: boolean;
  tier?: SourceTier;
}

export interface ResearchFinding {
  id: string;
  category: ResearchFindingCategory;
  title: string;
  summary: string;
  impact: ResearchFindingImpact;
  relevance: string;
  sources: ResearchSource[];
  thesisCheckpointId?: string;
  // Phase 6A: optional links to MemoUnderstanding ids so research findings
  // can be threaded back to specific memo flags / research tasks.
  linkedFlagId?: string;
  linkedResearchTaskId?: string;
}

export interface ResearchThesisCheckpointImpact {
  checkpointId: string;
  impact: "supported" | "challenged" | "no_update";
  note: string;
  findingIds: string[];
}

export interface ResearchFindings {
  generatedAt: string;
  company: string;
  researchWindow: { startIsoMonth: string; endIsoMonth: string };
  findings: ResearchFinding[];
  positiveDevelopments: string[];
  negativeDevelopments: string[];
  neutralOrWatch: string[];
  thesisCheckpointImpact: ResearchThesisCheckpointImpact[];
  unresolvedQuestions: string[];
  warnings: string[];
}

export interface ResearchUpdatesRequest {
  project: {
    id: string;
    ticker?: string;
    companyName: string;
    sector?: string;
  };
  initialMemo: {
    id?: string;
    text: string;
    sourceFilename: string;
    sizeBytes: number;
  };
  dna: MemoDNA;
  detection: ResearchDetectionInput;
  thesisCheckpoints?: ThesisCheckpoint[];
  scope?: { maxFindings?: number };
}

export type ResearchErrorCode =
  | "not_configured"
  | "provider_missing"
  | "api_key_missing"
  | "gate_misconfigured"
  | "llm_access_denied"
  | "research_unavailable"
  | "research_no_sources"
  | "provider_error"
  | "parse_error"
  | "timeout"
  | "rate_limited";

export type ResearchUpdatesResponse =
  | {
      ok: true;
      research: ResearchFindings;
      providerMetadata: LlmProviderMetadata;
      warnings: LlmGenerationWarning[];
    }
  | {
      ok: false;
      code: ResearchErrorCode;
      message: string;
      providerName?: LlmProviderName;
      modelUsed?: string;
      fallbackAvailable: true;
    };

export type ResearchGenerationState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "success";
      research: ResearchFindings;
      providerMetadata: LlmProviderMetadata;
      warnings: LlmGenerationWarning[];
    }
  | { kind: "error"; code: ResearchErrorCode; message: string };

export type LlmGenerationErrorCode =
  | "not_configured"
  | "provider_missing"
  | "api_key_missing"
  | "gate_misconfigured"
  | "llm_access_denied"
  | "provider_error"
  | "parse_error"
  | "timeout"
  | "rate_limited";

export interface LlmGenerationWarning {
  // Phase 6A.3: "baseline_recovery" + "baseline_after_timeout" added —
  // emitted by the deterministic memo-baseline tier so the dashboard can
  // render the "Recovered from memo text" ribbon.
  code:
    | LlmGenerationErrorCode
    | "schema_warning"
    | "baseline_recovery"
    | "baseline_after_timeout";
  message: string;
}

export type GenerateFollowUpMemoResponse =
  | {
      ok: true;
      memo: FollowUpMemo;
      providerMetadata: LlmProviderMetadata;
      warnings: LlmGenerationWarning[];
    }
  | {
      ok: false;
      code: LlmGenerationErrorCode;
      message: string;
      providerName?: LlmProviderName;
      modelUsed?: string;
      fallbackAvailable: true;
    };

export type FollowUpMemoSourceMode = "demo" | "deterministic" | "llm";

export type LlmGenerationState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "success";
      memo: FollowUpMemo;
      providerMetadata: LlmProviderMetadata;
      usedFallback: boolean;
      warnings: LlmGenerationWarning[];
    }
  | { kind: "error"; error: string };

// ---------- Phase 5D additions: section-by-section memo generation ----------

// Phase 6H: canonical section ids now live in a single module imported by
// BOTH bundles (worker + client). Re-exported here so the many existing
// `@shared/types` importers keep working unchanged. Do NOT re-introduce a
// literal id list anywhere — import from @shared/sectionIds.
import type { CanonicalSectionId } from "./sectionIds";
export type { CanonicalSectionId };
export {
  CORE_MEMO_SECTION_PREFIX,
  SUPPLEMENTARY_PANEL_PREFIX,
} from "./sectionIds";

export interface MemoSectionDigestEntry {
  id: CanonicalSectionId;
  signal: MemoSectionSignal;
  confidence?: MemoConfidence;
  summary: string;
  topBullets: string[];
}

export interface GenerateMemoSectionRequest {
  sectionId: CanonicalSectionId;
  project: {
    id: string;
    ticker: string;
    companyName: string;
    sector?: string;
  };
  dna: MemoDNA;
  detection?: ResearchDetectionInput;
  relevantFindings: ResearchFinding[];
  relevantCheckpointImpacts?: ResearchThesisCheckpointImpact[];
  positiveDevelopmentIds?: string[];
  negativeDevelopmentIds?: string[];
  watchDevelopmentIds?: string[];
  styleSample?: string[];
  initialMemoId?: string;
  priorSectionsDigest?: MemoSectionDigestEntry[];
  // Phase 6A/6B: optional MemoUnderstanding digest. When present, section
  // prompts add memo-specific anchors (thesis pillars, flagged details,
  // valuation framework) — used by every core sec_* section + the three
  // supplementary sup_* panels.
  memoUnderstandingDigest?: MemoUnderstandingDigest;
  // Phase 6C: user-supplied priorities echoed into every section prompt,
  // so the memo body explicitly addresses the items the user asked us
  // to test in addition to the auto-extracted flags.
  userPriorities?: string;
  retryCompact?: boolean;
}

export type GenerateMemoSectionResponse =
  | {
      ok: true;
      section: MemoSection;
      providerMetadata: LlmProviderMetadata;
      warnings: LlmGenerationWarning[];
    }
  | {
      ok: false;
      code: LlmGenerationErrorCode;
      message: string;
      providerName?: LlmProviderName;
      modelUsed?: string;
      sectionId: CanonicalSectionId;
    };

// ---------- Priorities-answer: dashboard-only, separate from the memo ----
//
// User-supplied priority questions ("are large MFs trimming?", "did the
// auditor flag anything?") are answered HERE, not woven into the main memo.
// The downloadable PDF is intentionally NOT shaped by these — the principle
// is that the same generic high-quality memo ships every time, while any
// PM-specific Q&A lives on the dashboard.

export interface PrioritiesAnswerItem {
  question: string;
  answer: string;
  confidence?: MemoConfidence;
  sources?: SourceReference[];
}

export interface PrioritiesAnswer {
  generatedAt: string;
  items: PrioritiesAnswerItem[];
}

export interface GeneratePrioritiesAnswerRequest {
  project: {
    id: string;
    ticker: string;
    companyName: string;
    sector?: string;
  };
  dna: MemoDNA;
  detection?: ResearchDetectionInput;
  research: ResearchFindings | null;
  memoUnderstandingDigest?: MemoUnderstandingDigest;
  userPriorities: string;
  initialMemoId?: string;
}

export type GeneratePrioritiesAnswerResponse =
  | {
      ok: true;
      answer: PrioritiesAnswer;
      providerMetadata: LlmProviderMetadata;
      warnings: LlmGenerationWarning[];
    }
  | {
      ok: false;
      code: LlmGenerationErrorCode;
      message: string;
      providerName?: LlmProviderName;
      modelUsed?: string;
    };

export type PrioritiesAnswerState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; answer: PrioritiesAnswer }
  | { kind: "error"; code: LlmGenerationErrorCode; message: string };

export type SectionRunStatus = "pending" | "running" | "success" | "failed";

export interface SectionRunState {
  id: CanonicalSectionId;
  title: string;
  status: SectionRunStatus;
  attempt: 0 | 1 | 2;
  errorCode?: LlmGenerationErrorCode;
  errorMessage?: string;
  // True when the orchestrator has decided not to generate this section for
  // this memo (e.g. the original memo never covered shareholding, or the
  // always-excluded Updated Investment View). Skipped sections are hidden from
  // the progress UI and the section count so the analyst only ever sees the
  // sections actually being drafted.
  skipped?: boolean;
}

export interface MemoGenerationProgress {
  kind: "idle" | "running" | "complete" | "failed";
  startedAt?: string;
  sections: SectionRunState[];
  completedCount: number;
  failedSectionId?: CanonicalSectionId;
}

// ---------- Phase 5E additions: multi-pass research ----------

export type ResearchPassId =
  | "official_results"
  | "management_call"
  | "investor_presentation"
  | "press_and_results"
  | "valuation_market"
  | "risks_competition";

export interface ResearchPassCompanyAliases {
  longName: string;
  shortName?: string;
  informalName?: string;
  ticker?: string;
  exchangeTicker?: string;
  exchangeTickerAlt?: string;
  ric?: string;
}

export interface ResearchPassCompactDna {
  projectId: string;
  originalThesisHead: string;
  keyAssumptions: string[];
  toneAdjectives: string[];
  analyticalFramework: string[];
  valuationFramework: {
    method: string;
    targetMultiple: string;
    bridgeNotes: string[];
  };
  thesisCheckpoints: Array<{
    id: string;
    label: string;
    expectedDirection: "up" | "down" | "flat";
  }>;
}

export interface ResearchPassRequest {
  passId: ResearchPassId;
  project: {
    id: string;
    ticker?: string;
    companyName: string;
    sector?: string;
  };
  companyAliases: ResearchPassCompanyAliases;
  dna: ResearchPassCompactDna;
  detection: ResearchDetectionInput;
  thesisCheckpoints?: ThesisCheckpoint[];
  // Phase 6A: optional MemoUnderstanding digest + per-pass task list.
  // When the digest is present, the pass prompt renders the
  // "Memo-specific anchor for this pass" block listing thesis pillars,
  // flagged details, and research questions selected for this passId.
  memoUnderstandingDigest?: MemoUnderstandingDigest;
  passMemoTasks?: MemoUnderstandingResearchTask[];
  // Phase 6C: user-supplied research priorities — free text the user
  // entered into the dashboard's "What else should we test?" textarea.
  // When present, the pass prompt renders an extra block telling the
  // model to also validate these specific items where they fall within
  // the pass scope.
  userPriorities?: string;
  retryCompact?: boolean;
}

export interface ResearchPassHarvestedUrl {
  url: string;
  title?: string;
  date?: string;
}

export type ResearchPassResponse =
  | {
      ok: true;
      passId: ResearchPassId;
      findings: ResearchFinding[];
      harvestedUrls: ResearchPassHarvestedUrl[];
      unresolvedQuestions: string[];
      warnings: LlmGenerationWarning[];
      providerMetadata: LlmProviderMetadata;
    }
  | {
      ok: false;
      passId: ResearchPassId;
      code: ResearchErrorCode;
      message: string;
      providerName?: LlmProviderName;
      modelUsed?: string;
    };

export type ResearchPassStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped";

export interface ResearchPassRunState {
  id: ResearchPassId;
  title: string;
  status: ResearchPassStatus;
  attempt: 0 | 1 | 2;
  errorCode?: ResearchErrorCode;
  errorMessage?: string;
  findingCount?: number;
}

export interface ResearchProgress {
  kind:
    | "idle"
    | "running"
    | "complete"
    | "complete_with_warnings"
    | "failed";
  startedAt?: string;
  passes: ResearchPassRunState[];
  failedPassIds: ResearchPassId[];
}

// ---------- Phase 6A additions: Memo Understanding Engine ----------

export type MemoUnderstandingImportance =
  | "critical"
  | "high"
  | "medium"
  | "low";

export type MemoUnderstandingResearchPriority =
  | "must_check"
  | "important"
  | "nice_to_have";

export type MemoUnderstandingClaimType =
  | "reported"
  | "forecast"
  | "estimate"
  | "guidance"
  | "assumption";

export type MemoUnderstandingFlagCategory =
  | "valuation_anchor"
  | "financial_claim"
  | "segment_driver"
  | "margin_driver"
  | "earnings_quality"
  | "management_claim"
  | "catalyst"
  | "risk"
  | "source_gap"
  | "contradiction"
  | "must_verify";

export type MemoUnderstandingSourcePriority =
  | "company_filings"
  | "exchange_filings"
  | "earnings_call"
  | "investor_presentation"
  | "broker_notes"
  | "market_data"
  | "press";

export interface MemoUnderstandingFlaggedDetail {
  id: string;
  label: string;
  detail: string;
  category: MemoUnderstandingFlagCategory;
  importance: MemoUnderstandingImportance;
  whyItMatters: string;
  memoEvidence: string;
  researchQuestion: string;
}

export interface MemoUnderstandingThesisPillar {
  id: string;
  label: string;
  originalClaim: string;
  evidenceFromMemo: string;
  importance: "high" | "medium" | "low";
  needsResearch: boolean;
  researchPriority: MemoUnderstandingResearchPriority;
}

export interface MemoUnderstandingFinancialClaim {
  id: string;
  metric: string;
  value: string;
  period?: string;
  segment?: string;
  claimType: MemoUnderstandingClaimType;
  whyItMatters: string;
  researchQuestion: string;
}

export interface MemoUnderstandingSegmentClaim {
  id: string;
  segment: string;
  claim: string;
  metric?: string;
  value?: string;
  period?: string;
  importance: "high" | "medium" | "low";
  researchQuestion: string;
}

export interface MemoUnderstandingResearchTask {
  id: string;
  label: string;
  question: string;
  memoAnchor: string;
  linkedFlagIds: string[];
  linkedPillarIds: string[];
  linkedFinancialClaimIds: string[];
  preferredSources: MemoUnderstandingSourcePriority[];
  expectedEvidence: string;
  priority: MemoUnderstandingResearchPriority;
}

export interface MemoUnderstanding {
  projectId: string;
  company: {
    detectedName: string;
    normalizedName?: string;
    ticker?: string;
    aliases: string[];
    sector?: string;
    geography?: string;
  };
  memo: {
    broker?: string;
    author?: string;
    publishedDate?: string;
    periodCovered?: string;
    reportType?: string;
    recommendation?: string;
    targetPrice?: string;
    currentPriceAtMemo?: string;
    upsideAtMemo?: string;
    timeHorizon?: string;
  };
  summary: {
    oneLineSummary: string;
    shortSummary: string;
    originalThesis: string;
    whatTheMemoNeedsToBeRight: string[];
    whatWouldChangeTheView: string[];
  };
  flaggedDetails: MemoUnderstandingFlaggedDetail[];
  thesis: {
    oneLineThesis: string;
    detailedThesis: string;
    thesisPillars: MemoUnderstandingThesisPillar[];
  };
  financials: {
    keyClaims: MemoUnderstandingFinancialClaim[];
    segmentClaims: MemoUnderstandingSegmentClaim[];
  };
  valuation: {
    method?: string;
    targetMultiple?: string;
    targetMetric?: string;
    impliedEPS?: string;
    targetPrice?: string;
    upside?: string;
    keyValuationAssumptions: string[];
    valuationQuestionsToUpdate: string[];
  };
  risksAndCatalysts: {
    catalysts: string[];
    risks: string[];
    watchItems: string[];
  };
  researchPlan: {
    mustAnswerQuestions: string[];
    sourcePriorities: MemoUnderstandingSourcePriority[];
    researchTasks: MemoUnderstandingResearchTask[];
  };
  confidence: {
    extractionConfidence: "high" | "medium" | "low";
    missingFromMemo: string[];
    ambiguousItems: string[];
  };
}

// Compact form sent to /api/research/pass and /api/generate/memo-section.
// Caps enforced by buildMemoUnderstandingDigest (frontend pure helper).
export interface MemoUnderstandingDigest {
  projectId: string;
  oneLineSummary: string;
  recommendation?: string;
  targetPrice?: string;
  valuation: {
    method?: string;
    targetMultiple?: string;
    impliedEPS?: string;
  };
  thesisPillars: Array<{
    id: string;
    label: string;
    importance: "high" | "medium" | "low";
    researchPriority: MemoUnderstandingResearchPriority;
  }>;
  flaggedDetails: Array<
    Pick<
      MemoUnderstandingFlaggedDetail,
      | "id"
      | "label"
      | "detail"
      | "category"
      | "importance"
      | "whyItMatters"
      | "researchQuestion"
    >
  >;
  financialClaims: Array<
    Pick<
      MemoUnderstandingFinancialClaim,
      | "id"
      | "metric"
      | "value"
      | "period"
      | "claimType"
      | "whyItMatters"
      | "researchQuestion"
    >
  >;
  researchTasks: Array<
    Pick<
      MemoUnderstandingResearchTask,
      | "id"
      | "question"
      | "memoAnchor"
      | "linkedFlagIds"
      | "linkedPillarIds"
      | "preferredSources"
      | "priority"
    >
  >;
}

export interface MemoUnderstandRequest {
  project: {
    id: string;
    ticker?: string;
    companyName: string;
    sector?: string;
  };
  detection?: ResearchDetectionInput;
  memo: {
    id?: string;
    text: string;
    sourceFilename: string;
    sizeBytes: number;
  };
  dna?: MemoDNA;
}

export type MemoUnderstandErrorCode = ResearchErrorCode;

export type MemoUnderstandResponse =
  | {
      ok: true;
      understanding: MemoUnderstanding;
      providerMetadata: LlmProviderMetadata;
      warnings: LlmGenerationWarning[];
    }
  | {
      ok: false;
      code: MemoUnderstandErrorCode;
      message: string;
      providerName?: LlmProviderName;
      modelUsed?: string;
    };

export type MemoUnderstandingState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "success";
      understanding: MemoUnderstanding;
      providerMetadata: LlmProviderMetadata;
      warnings: LlmGenerationWarning[];
    }
  | { kind: "error"; code: MemoUnderstandErrorCode; message: string };

// ---------- Company picker: stock search (devde.muns.io proxy) ----------

// One row of the stock-search dropdown. Derived from the upstream
// `data.results` map, where each entry is keyed by ticker and the value is
// the positional tuple [country, name, sector].
export interface StockSearchResult {
  ticker: string;
  name: string;
  country: string;
  sector: string;
}

export interface StockSearchRequest {
  query: string;
}

export type StockSearchErrorCode =
  | "invalid_request"
  | "not_configured"
  | "upstream_error"
  | "timeout"
  | "provider_error";

export type StockSearchResponse =
  | {
      ok: true;
      query: string;
      totalResults: number;
      results: StockSearchResult[];
    }
  | {
      ok: false;
      code: StockSearchErrorCode;
      message: string;
    };

// ---------- Live stock quote (server-side fetch) ----------
//
// The Worker scrapes Google Finance / Yahoo Finance / Screener server-side
// and returns a normalised live quote. The orchestrator calls this once per
// memo run and injects the result into ResearchDetectionInput.currentPrice
// so the LLM uses the day's price verbatim instead of searching for it.

export interface StockQuoteRequest {
  ticker: string;
  // Optional exchange hint, used to pick the right Google Finance URL
  // (RATEGAIN:NSE vs AAPL:NASDAQ). When omitted, the route tries the most
  // likely exchange(s) for the country.
  exchange?: string;
  country?: string;
  companyName?: string;
}

export type StockQuoteErrorCode =
  | "invalid_request"
  | "not_found"
  | "upstream_error"
  | "timeout"
  | "provider_error";

export type StockQuoteResponse =
  | {
      ok: true;
      ticker: string;
      price: number;
      currency: string;
      asOf: string;
      source: string;
      display: string;
      // Optional CURRENT fundamentals — present when the upstream source
      // returns them. Absent fields lead the prompt to mark the cell as
      // 'not surfaced'; the model NEVER fabricates a substitute.
      // (Forward fields intentionally absent — the analyst's principle:
      // only sourced current metrics compared to memo-date anchors.)
      trailingEps?: number;
      trailingPE?: number;
      marketCap?: number;
      enterpriseValue?: number;
      trailingEvToEbitda?: number;
      priceToBook?: number;
      bookValue?: number;
      fiftyTwoWeekHigh?: number;
      fiftyTwoWeekLow?: number;
      // Pre-formatted summary line ("Rs 871 (as of 2026-06-19); mkt cap
      // Rs 89.6 bn; EV Rs 92.1 bn; trailing P/E 46.2x; trailing EV/EBITDA
      // 28.1x; P/B 5.2x; 52w 417.6–902"). When present the section prompt
      // uses this verbatim as a single fundamentals block.
      fundamentalsDisplay?: string;
    }
  | {
      ok: false;
      code: StockQuoteErrorCode;
      message: string;
    };

// The company the user picked from the search box. This is the AUTHORITATIVE
// identity for the project — it overrides the heuristic company/ticker that
// `detectPeriodFromMemoText` guesses from the memo body (which can latch onto
// a segment line-item, e.g. "Lloyd Electric" inside a Havells report).
export interface SelectedCompany {
  ticker: string;
  companyName: string;
  country?: string;
  sector?: string;
}

// ---------------------------------------------------------------------------
// Comprehensive research report (Stage 1 of the research rearchitecture).
//
// Instead of narrowing research to only the memo-flagged anchors, we run a
// full, company-wide research pass structured to the analyst's master prompt
// and keep the complete long report internally. The delivered <3-page memo is
// condensed from it, and a post-delivery Q&A answers follow-ups from it — no
// repeat research. These types describe that stored report.
// ---------------------------------------------------------------------------

export type ResearchReportSectionId =
  | "stock_valuation"
  | "executive_update"
  | "shareholding"
  | "industry_regulatory"
  | "corporate_events"
  | "management_governance"
  | "concall"
  | "memo_vs_actual"
  | "updated_view";

// A web source grounding a report section (harvested from the web_search tool).
export interface ReportSource {
  url: string;
  title?: string;
  date?: string;
}

export interface ResearchReportSection {
  id: ResearchReportSectionId;
  title: string;
  // The section body as markdown prose (tables allowed), per the master prompt.
  markdown: string;
  sources: ReportSource[];
  // Datapoints the model flagged as "not disclosed" rather than estimating.
  notDisclosed?: string[];
}

export interface FullResearchReport {
  company: string;
  ticker?: string;
  periodLabel?: string;
  generatedAt: string;
  sections: ResearchReportSection[];
}

export interface ResearchReportProjectRef {
  id: string;
  companyName: string;
  ticker?: string;
  sector?: string;
}

export interface ResearchReportDetectionInput {
  periodLabel: string;
  researchStart?: string;
  researchCurrent: string;
  memoWrittenOn?: string;
}

export interface ResearchReportSectionRequest {
  section: ResearchReportSectionId;
  project: ResearchReportProjectRef;
  companyAliases: { longName: string; aliases?: string[] };
  detection: ResearchReportDetectionInput;
  // Optional memo context (thesis / financials / target) for the sections that
  // compare against the original memo (executive update, memo-vs-actual, view).
  memoContext?: string;
  retryCompact?: boolean;
}

export interface ResearchReportProviderMetadata {
  providerName: LlmProviderName;
  modelUsed?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export type ResearchReportSectionResponse =
  | {
      ok: true;
      section: ResearchReportSectionId;
      markdown: string;
      sources: ReportSource[];
      notDisclosed: string[];
      // Structured, grounded findings emitted alongside the prose — assembled
      // client-side into ResearchFindings that feed the memo drafter.
      findings: ResearchFinding[];
      unresolvedQuestions: string[];
      providerMetadata?: ResearchReportProviderMetadata;
    }
  | {
      ok: false;
      section: ResearchReportSectionId;
      code: ResearchErrorCode;
      message: string;
      providerName?: LlmProviderName;
      modelUsed?: string;
    };

export type ResearchReportSectionStatus =
  | "pending"
  | "running"
  | "success"
  | "failed";

export interface ResearchReportSectionRunState {
  id: ResearchReportSectionId;
  title: string;
  status: ResearchReportSectionStatus;
  attempt: 0 | 1 | 2;
  errorCode?: ResearchErrorCode;
}

export type FullResearchReportState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; report: FullResearchReport }
  | { kind: "error"; code: ResearchErrorCode | "aborted"; message: string };
