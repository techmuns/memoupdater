import type {
  CanonicalSectionId,
  FollowUpMemo,
  GenerateMemoSectionRequest,
  GenerateMemoSectionResponse,
  LlmGenerationErrorCode,
  MemoDNA,
  MemoSection,
  MemoSectionDigestEntry,
  ResearchDetectionInput,
  ResearchFinding,
  ResearchFindingCategory,
  ResearchFindings,
  ResearchThesisCheckpointImpact,
} from "@shared/types";

export const CANONICAL_SECTION_IDS: readonly CanonicalSectionId[] = [
  "sec_thesis_snapshot",
  "sec_q4_retest",
  "sec_mgmt_retest",
  "sec_ai_macro_risk",
  "sec_memo_held",
  "sec_memo_broke",
  "sec_eps_bridge",
  "sec_valuation_peer_gap",
  "sec_final_action",
] as const;

export const SECTION_TITLES: Record<CanonicalSectionId, string> = {
  sec_thesis_snapshot: "Original Thesis Snapshot",
  sec_q4_retest: "Latest Financial Re-test",
  sec_mgmt_retest: "Management Commentary Re-test",
  sec_ai_macro_risk: "AI / Macro / Competitive Risk Check",
  sec_memo_held: "Where the Original Memo Held",
  sec_memo_broke: "Where the Original Memo Broke",
  sec_eps_bridge: "EPS Credibility Bridge",
  sec_valuation_peer_gap: "Valuation and Peer Gap",
  sec_final_action: "Final Investment Action",
};

// Static category-to-section map. Watch findings are NEVER ignored — they
// always feed at least one of memo_held / memo_broke / eps / valuation /
// final, via the impact + checkpoint cross-cuts below.
const CATEGORY_MAP: Record<CanonicalSectionId, Set<ResearchFindingCategory>> = {
  sec_thesis_snapshot: new Set(),
  sec_q4_retest: new Set(["financials", "guidance"]),
  sec_mgmt_retest: new Set(["management", "filings", "broker_consensus"]),
  sec_ai_macro_risk: new Set(["ai_tech_risk", "macro", "peers"]),
  sec_memo_held: new Set([
    "financials",
    "guidance",
    "management",
    "filings",
    "broker_consensus",
    "valuation",
    "peers",
    "macro",
    "ai_tech_risk",
    "other",
  ]),
  sec_memo_broke: new Set([
    "financials",
    "guidance",
    "management",
    "filings",
    "broker_consensus",
    "valuation",
    "peers",
    "macro",
    "ai_tech_risk",
    "other",
  ]),
  sec_eps_bridge: new Set(["financials", "guidance", "valuation"]),
  sec_valuation_peer_gap: new Set(["valuation", "peers"]),
  sec_final_action: new Set([
    "financials",
    "guidance",
    "management",
    "filings",
    "broker_consensus",
    "valuation",
    "peers",
    "macro",
    "ai_tech_risk",
    "other",
  ]),
};

const IMPACT_RANK: Record<ResearchFinding["impact"], number> = {
  negative: 3,
  positive: 2,
  watch: 1,
  neutral: 0,
};

export interface SectionSelection {
  findings: ResearchFinding[];
  checkpoints: ResearchThesisCheckpointImpact[];
  positiveIds: string[];
  negativeIds: string[];
  watchIds: string[];
}

export function selectFindingsForSection(
  sectionId: CanonicalSectionId,
  research: ResearchFindings | null,
  limit: number,
): SectionSelection {
  if (!research) {
    return {
      findings: [],
      checkpoints: [],
      positiveIds: [],
      negativeIds: [],
      watchIds: [],
    };
  }
  const all = research.findings;
  const positives = new Set(research.positiveDevelopments);
  const negatives = new Set(research.negativeDevelopments);
  const watches = new Set(research.neutralOrWatch);
  let picked: ResearchFinding[];

  switch (sectionId) {
    case "sec_thesis_snapshot": {
      picked = [];
      break;
    }
    case "sec_memo_held": {
      picked = all.filter((f) => positives.has(f.id) || isWatchSupported(f, research));
      break;
    }
    case "sec_memo_broke": {
      picked = all.filter((f) => negatives.has(f.id) || isWatchChallenged(f, research));
      break;
    }
    case "sec_final_action": {
      const top = (set: Set<string>, n: number): ResearchFinding[] =>
        all
          .filter((f) => set.has(f.id))
          .sort(byImpactRank)
          .slice(0, n);
      const merged = new Map<string, ResearchFinding>();
      for (const f of top(positives, 3)) merged.set(f.id, f);
      for (const f of top(negatives, 3)) merged.set(f.id, f);
      for (const f of top(watches, 3)) merged.set(f.id, f);
      picked = [...merged.values()];
      break;
    }
    case "sec_eps_bridge": {
      const allowed = CATEGORY_MAP.sec_eps_bridge;
      picked = all.filter((f) => allowed.has(f.category) || mentionsEarnings(f));
      break;
    }
    case "sec_valuation_peer_gap": {
      const allowed = CATEGORY_MAP.sec_valuation_peer_gap;
      picked = all.filter(
        (f) => allowed.has(f.category) || (watches.has(f.id) && mentionsValuation(f)),
      );
      break;
    }
    default: {
      const allowed = CATEGORY_MAP[sectionId];
      picked = all.filter((f) => allowed.has(f.category));
    }
  }

  picked = [...picked].sort(byImpactRank).slice(0, Math.max(0, limit));
  const pickedIds = new Set(picked.map((f) => f.id));
  const checkpoints = research.thesisCheckpointImpact.filter((c) =>
    c.findingIds.some((id) => pickedIds.has(id)),
  );
  const positiveIds = picked.filter((f) => positives.has(f.id)).map((f) => f.id);
  const negativeIds = picked.filter((f) => negatives.has(f.id)).map((f) => f.id);
  const watchIds = picked.filter((f) => watches.has(f.id)).map((f) => f.id);

  return { findings: picked, checkpoints, positiveIds, negativeIds, watchIds };
}

function byImpactRank(a: ResearchFinding, b: ResearchFinding): number {
  return IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact];
}

function isWatchSupported(f: ResearchFinding, research: ResearchFindings): boolean {
  if (f.impact !== "watch") return false;
  return research.thesisCheckpointImpact.some(
    (c) => c.impact === "supported" && c.findingIds.includes(f.id),
  );
}

function isWatchChallenged(f: ResearchFinding, research: ResearchFindings): boolean {
  if (f.impact !== "watch") return false;
  return research.thesisCheckpointImpact.some(
    (c) => c.impact === "challenged" && c.findingIds.includes(f.id),
  );
}

function mentionsEarnings(f: ResearchFinding): boolean {
  const text = `${f.summary} ${f.relevance}`.toLowerCase();
  return /\b(eps|earnings|pat|profit|margin|guidance)\b/.test(text);
}

function mentionsValuation(f: ResearchFinding): boolean {
  const text = `${f.summary} ${f.relevance}`.toLowerCase();
  return /\b(valuation|multiple|p\/e|price target|target price|peer)\b/.test(text);
}

export function distillStyleSample(dna: MemoDNA, maxChars: number): string[] {
  const out: string[] = [];
  let running = 0;
  for (const s of dna.styleTone.sampleSentences ?? []) {
    const cleaned = s.trim();
    if (!cleaned) continue;
    if (running + cleaned.length > maxChars) break;
    out.push(cleaned);
    running += cleaned.length;
    if (out.length >= 5) break;
  }
  if (out.length === 0 && dna.originalThesis) {
    out.push(dna.originalThesis.slice(0, Math.min(800, maxChars)));
  }
  return out;
}

const DIGEST_SECTION_IDS: CanonicalSectionId[] = [
  "sec_memo_held",
  "sec_memo_broke",
  "sec_eps_bridge",
  "sec_valuation_peer_gap",
];

export function buildPriorSectionsDigest(
  completed: Partial<Record<CanonicalSectionId, MemoSection>>,
): MemoSectionDigestEntry[] {
  const out: MemoSectionDigestEntry[] = [];
  for (const id of DIGEST_SECTION_IDS) {
    const s = completed[id];
    if (!s) continue;
    out.push({
      id,
      signal: s.signal ?? "neutral",
      confidence: s.confidence,
      summary: truncate(s.summary ?? "", 250),
      topBullets: (s.bullets ?? []).slice(0, 2).map((b) => truncate(b, 200)),
    });
  }
  return out;
}

export interface AssembleMemoArgs {
  project: { id: string; companyName: string };
  sections: MemoSection[];
  research: ResearchFindings | null;
  generatedAt: string;
}

export function assembleMemo(args: AssembleMemoArgs): FollowUpMemo {
  const ordered: MemoSection[] = [];
  const map = new Map<string, MemoSection>();
  for (const s of args.sections) map.set(s.id, s);
  for (const id of CANONICAL_SECTION_IDS) {
    const s = map.get(id);
    if (s) ordered.push(s);
  }
  if (ordered.length !== 9) {
    throw new Error(
      `assembleMemo: expected 9 canonical sections, got ${ordered.length}`,
    );
  }

  const memo: FollowUpMemo = {
    projectId: args.project.id,
    title: `Follow-up Memo — ${args.project.companyName}`,
    generatedAt: args.generatedAt,
    sections: ordered,
    isDemo: false,
    sourceMode: "llm",
  };

  const manualChecks = deriveManualChecksRemaining(args.research);
  if (manualChecks.length > 0) {
    memo.manualChecksRemaining = manualChecks;
  }
  return memo;
}

function deriveManualChecksRemaining(research: ResearchFindings | null): string[] {
  if (research === null) {
    return [
      "External research was not run for this memo; all forward-looking claims need to be verified by a human analyst.",
    ];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of research.unresolvedQuestions ?? []) {
    if (typeof q !== "string") continue;
    const trimmed = q.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= 6) break;
  }
  return out;
}

// --- Orchestration ---

export interface RunSectionGenerationArgs {
  project: { id: string; ticker: string; companyName: string; sector?: string };
  dna: MemoDNA;
  detection?: ResearchDetectionInput;
  research: ResearchFindings | null;
  initialMemoId?: string;
  apiCall: (
    req: GenerateMemoSectionRequest,
    signal?: AbortSignal,
  ) => Promise<GenerateMemoSectionResponse>;
  signal?: AbortSignal;
  onSectionStart: (sectionId: CanonicalSectionId, attempt: 1 | 2) => void;
  onSectionDone: (sectionId: CanonicalSectionId, section: MemoSection) => void;
  onSectionFail: (
    sectionId: CanonicalSectionId,
    code: LlmGenerationErrorCode,
    message: string,
  ) => void;
  startFromSectionId?: CanonicalSectionId;
  existingSections?: Partial<Record<CanonicalSectionId, MemoSection>>;
}

export type RunSectionGenerationResult =
  | { ok: true; memo: FollowUpMemo }
  | {
      ok: false;
      code: LlmGenerationErrorCode | "aborted";
      message: string;
      failedSectionId?: CanonicalSectionId;
      completedSections: Partial<Record<CanonicalSectionId, MemoSection>>;
    };

const RETRY_COMPACT_CODES: ReadonlySet<LlmGenerationErrorCode> = new Set([
  "timeout",
  "provider_error",
  "parse_error",
  "rate_limited",
]);

export async function runSectionGeneration(
  args: RunSectionGenerationArgs,
): Promise<RunSectionGenerationResult> {
  const completed: Partial<Record<CanonicalSectionId, MemoSection>> = {
    ...(args.existingSections ?? {}),
  };
  const startIdx = args.startFromSectionId
    ? Math.max(0, CANONICAL_SECTION_IDS.indexOf(args.startFromSectionId))
    : 0;

  for (let i = 0; i < CANONICAL_SECTION_IDS.length; i++) {
    const sectionId = CANONICAL_SECTION_IDS[i];
    if (i < startIdx && completed[sectionId]) continue;

    if (args.signal?.aborted) {
      return {
        ok: false,
        code: "aborted",
        message: "Generation aborted",
        completedSections: completed,
      };
    }

    const request = buildSectionRequest(args, sectionId, completed, false);

    args.onSectionStart(sectionId, 1);
    let response = await safeCall(args.apiCall, request, args.signal);

    if (response.aborted) {
      return {
        ok: false,
        code: "aborted",
        message: "Generation aborted",
        failedSectionId: sectionId,
        completedSections: completed,
      };
    }

    if (
      !response.value.ok &&
      RETRY_COMPACT_CODES.has(response.value.code) &&
      !args.signal?.aborted
    ) {
      const retryReq = buildSectionRequest(args, sectionId, completed, true);
      args.onSectionStart(sectionId, 2);
      response = await safeCall(args.apiCall, retryReq, args.signal);
      if (response.aborted) {
        return {
          ok: false,
          code: "aborted",
          message: "Generation aborted",
          failedSectionId: sectionId,
          completedSections: completed,
        };
      }
    }

    if (!response.value.ok) {
      args.onSectionFail(sectionId, response.value.code, response.value.message);
      return {
        ok: false,
        code: response.value.code,
        message: response.value.message,
        failedSectionId: sectionId,
        completedSections: completed,
      };
    }

    completed[sectionId] = response.value.section;
    args.onSectionDone(sectionId, response.value.section);
  }

  const orderedSections: MemoSection[] = [];
  for (const id of CANONICAL_SECTION_IDS) {
    const s = completed[id];
    if (s) orderedSections.push(s);
  }
  const memo = assembleMemo({
    project: { id: args.project.id, companyName: args.project.companyName },
    sections: orderedSections,
    research: args.research,
    generatedAt: new Date().toISOString(),
  });
  return { ok: true, memo };
}

interface SafeCallResult {
  aborted: boolean;
  value: GenerateMemoSectionResponse;
}

async function safeCall(
  apiCall: RunSectionGenerationArgs["apiCall"],
  req: GenerateMemoSectionRequest,
  signal: AbortSignal | undefined,
): Promise<SafeCallResult> {
  try {
    const value = await apiCall(req, signal);
    if (signal?.aborted) {
      return {
        aborted: true,
        value: {
          ok: false,
          code: "provider_error",
          message: "Aborted",
          sectionId: req.sectionId,
        },
      };
    }
    return { aborted: false, value };
  } catch (err) {
    if (signal?.aborted) {
      return {
        aborted: true,
        value: {
          ok: false,
          code: "provider_error",
          message: "Aborted",
          sectionId: req.sectionId,
        },
      };
    }
    const message = err instanceof Error ? err.message : "Network error";
    return {
      aborted: false,
      value: {
        ok: false,
        code: "provider_error",
        message,
        sectionId: req.sectionId,
      },
    };
  }
}

function buildSectionRequest(
  args: RunSectionGenerationArgs,
  sectionId: CanonicalSectionId,
  completed: Partial<Record<CanonicalSectionId, MemoSection>>,
  retryCompact: boolean,
): GenerateMemoSectionRequest {
  const limit = retryCompact ? 4 : 6;
  const selection = selectFindingsForSection(sectionId, args.research, limit);
  const styleSample = distillStyleSample(
    args.dna,
    retryCompact ? 800 : 1500,
  );
  const req: GenerateMemoSectionRequest = {
    sectionId,
    project: args.project,
    dna: args.dna,
    detection: args.detection,
    relevantFindings: selection.findings,
    relevantCheckpointImpacts:
      selection.checkpoints.length > 0 ? selection.checkpoints : undefined,
    positiveDevelopmentIds:
      selection.positiveIds.length > 0 ? selection.positiveIds : undefined,
    negativeDevelopmentIds:
      selection.negativeIds.length > 0 ? selection.negativeIds : undefined,
    watchDevelopmentIds:
      selection.watchIds.length > 0 ? selection.watchIds : undefined,
    styleSample: styleSample.length > 0 ? styleSample : undefined,
    initialMemoId: args.initialMemoId,
    retryCompact: retryCompact ? true : undefined,
  };
  if (sectionId === "sec_final_action") {
    const digest = buildPriorSectionsDigest(completed);
    if (digest.length > 0) req.priorSectionsDigest = digest;
  }
  return req;
}

function truncate(value: string, max: number): string {
  if (typeof value !== "string") return "";
  const s = value.trim();
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}
