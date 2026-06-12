import type {
  MemoDNA,
  MemoUnderstanding,
  MemoUnderstandingClaimType,
  MemoUnderstandingFinancialClaim,
  MemoUnderstandingFlagCategory,
  MemoUnderstandingFlaggedDetail,
  MemoUnderstandingImportance,
  MemoUnderstandingResearchTask,
  MemoUnderstandingSegmentClaim,
  MemoUnderstandingSourcePriority,
  MemoUnderstandingThesisPillar,
  ResearchDetectionInput,
} from "@shared/types";

// Phase 6A.3: deterministic memo-baseline recovery tier.
//
// Pure builder. NO provider calls. NO web. NO fabrication.
// Every `memoEvidence` slice is a verbatim substring of the
// uploaded memo text. Every regex hit references a real
// match position. Every research task carries a `memoAnchor`
// tied to a specific flag or pillar so memo-specific research
// stays memo-specific by construction.
//
// Inputs come from the same request the LLM tiers saw. Output
// is shape-correct for `parseUnderstandJson`.

export interface BuildBaselineArgs {
  projectId: string;
  companyName: string;
  ticker?: string;
  extractedText: string;
  dna?: MemoDNA;
  detection?: ResearchDetectionInput;
  recoveryReason: string;
}

// ---- Keyword tables (private) ----

type CategoryKey = MemoUnderstandingFlagCategory;

interface Keyword {
  re: RegExp;
  weight: number;
}

const KEYWORDS: Record<CategoryKey, Keyword[]> = {
  valuation_anchor: [
    { re: /\btarget price\b/i, weight: 5 },
    { re: /\bprice target\b/i, weight: 5 },
    { re: /\btarget multiple\b/i, weight: 4 },
    { re: /\bP\/E\b/i, weight: 4 },
    { re: /\bPE multiple\b/i, weight: 3 },
    { re: /\bEV\/EBITDA\b/i, weight: 4 },
    { re: /\bDCF\b/i, weight: 3 },
    { re: /\bSOTP\b/i, weight: 3 },
    { re: /EPS\s+Dec/i, weight: 4 },
    { re: /EPS\s+FY/i, weight: 4 },
    { re: /\b\d+(?:\.\d+)?x\b/, weight: 3 },
    { re: /\bupside\b/i, weight: 3 },
    { re: /\bdownside\b/i, weight: 3 },
    { re: /\b(?:BUY|ADD|HOLD|SELL|REDUCE|NEUTRAL|OVERWEIGHT|UNDERWEIGHT|OUTPERFORM|UNDERPERFORM)\b/, weight: 3 },
  ],
  earnings_quality: [
    { re: /\bPAT\b/, weight: 3 },
    { re: /\bnet profit\b/i, weight: 3 },
    { re: /\bother income\b/i, weight: 4 },
    { re: /\bfair value\b/i, weight: 4 },
    { re: /\bbelow[- ]the[- ]line\b/i, weight: 5 },
    { re: /\bone[- ]off\b/i, weight: 4 },
    { re: /\bexceptional\b/i, weight: 3 },
    { re: /\bnon[- ]recurring\b/i, weight: 4 },
    { re: /\bcore EBITDA\b/i, weight: 3 },
    { re: /\boperating[- ]led\b/i, weight: 3 },
  ],
  segment_driver: [
    { re: /\bC&W\b/, weight: 4 },
    { re: /\bcables\b/i, weight: 3 },
    { re: /\bwires\b/i, weight: 3 },
    { re: /\bLloyd\b/, weight: 4 },
    { re: /\bECD\b/, weight: 3 },
    { re: /\bRAC\b/, weight: 3 },
    { re: /\bswitchgear\b/i, weight: 3 },
    { re: /\blighting\b/i, weight: 3 },
    { re: /\bsegment\b/i, weight: 2 },
    { re: /\bdivision\b/i, weight: 2 },
    { re: /\bbusiness line\b/i, weight: 2 },
  ],
  margin_driver: [
    { re: /\bEBITDA margin\b/i, weight: 4 },
    { re: /\bEBIT margin\b/i, weight: 4 },
    { re: /\bgross margin\b/i, weight: 3 },
    { re: /\boperating margin\b/i, weight: 3 },
    { re: /\bmargin compression\b/i, weight: 4 },
    { re: /\bmargin expansion\b/i, weight: 4 },
  ],
  financial_claim: [
    { re: /\brevenue\b/i, weight: 2 },
    { re: /\bsales\b/i, weight: 2 },
    { re: /\bEBITDA\b/, weight: 3 },
    { re: /\bEBIT\b/, weight: 3 },
    { re: /\bgrowth\b/i, weight: 2 },
    { re: /\bYoY\b/, weight: 2 },
    { re: /\bQoQ\b/, weight: 2 },
    { re: /\d+%/, weight: 1 },
    { re: /\bRs[. ]/i, weight: 1 },
    { re: /\bINR\b/, weight: 1 },
  ],
  catalyst: [
    { re: /\bcatalyst\b/i, weight: 4 },
    { re: /\bre[- ]rating\b/i, weight: 3 },
    { re: /\btrigger\b/i, weight: 3 },
    { re: /\bmonsoon\b/i, weight: 2 },
    { re: /\bfestive\b/i, weight: 2 },
    { re: /\bcapacity\b/i, weight: 3 },
    { re: /\bexpansion\b/i, weight: 2 },
  ],
  risk: [
    { re: /\brisk\b/i, weight: 3 },
    { re: /\bslowdown\b/i, weight: 3 },
    { re: /\binventory\b/i, weight: 3 },
    { re: /\bchannel\b/i, weight: 2 },
    { re: /\bASP\b/, weight: 3 },
    { re: /\bpricing\b/i, weight: 2 },
    { re: /\bBEE\b/, weight: 3 },
    { re: /\binput cost\b/i, weight: 3 },
    { re: /\bregulatory\b/i, weight: 3 },
    { re: /\bheadwind\b/i, weight: 3 },
  ],
  must_verify: [
    { re: /\bexpect\b/i, weight: 1 },
    { re: /\bassume\b/i, weight: 2 },
    { re: /\bforecast\b/i, weight: 2 },
    { re: /\bestimate\b/i, weight: 2 },
    { re: /\bif\s/i, weight: 1 },
    { re: /\bshould\s/i, weight: 1 },
  ],
  management_claim: [
    { re: /\bmanagement\b/i, weight: 2 },
    { re: /\bguidance\b/i, weight: 3 },
    { re: /\bcommentary\b/i, weight: 2 },
    { re: /\bcommented\b/i, weight: 2 },
    { re: /\bstated\b/i, weight: 2 },
    { re: /\bsaid\b/i, weight: 1 },
  ],
  source_gap: [],
  contradiction: [],
};

// Output priority order — drives flag selection.
const CATEGORY_ORDER: CategoryKey[] = [
  "valuation_anchor",
  "earnings_quality",
  "segment_driver",
  "margin_driver",
  "financial_claim",
  "catalyst",
  "risk",
  "must_verify",
];

const CAT_TO_IMPORTANCE: Record<CategoryKey, MemoUnderstandingImportance> = {
  valuation_anchor: "critical",
  earnings_quality: "high",
  segment_driver: "high",
  margin_driver: "high",
  financial_claim: "medium",
  management_claim: "medium",
  catalyst: "high",
  risk: "high",
  must_verify: "medium",
  source_gap: "low",
  contradiction: "high",
};

const CAT_WHY: Record<CategoryKey, string> = {
  valuation_anchor: "Matters for updating the memo because the original valuation anchor must hold for the target price to be defensible.",
  earnings_quality: "Matters for updating the memo because the print quality decides whether the memo's growth thesis was operating-led or distorted by below-the-line items.",
  segment_driver: "Matters for updating the memo because this segment was a core driver of the original revenue thesis.",
  margin_driver: "Matters for updating the memo because the memo's margin assumption drives the EPS bridge and the implied target price.",
  financial_claim: "Matters for updating the memo because this financial line item underpins the memo's quantitative thesis.",
  management_claim: "Matters for updating the memo because management commentary anchored the memo's forward-looking expectations.",
  catalyst: "Matters for updating the memo because this catalyst was expected to drive the next leg of re-rating.",
  risk: "Matters for updating the memo because this risk could materially weaken the memo's forward-looking view.",
  must_verify: "Matters for updating the memo because this assumption must be re-verified before the memo's call can stand.",
  source_gap: "Matters for updating the memo because the original memo did not establish this point clearly.",
  contradiction: "Matters for updating the memo because the original memo's claim conflicts with a known data point.",
};

const CAT_QUESTION_TEMPLATE: Record<CategoryKey, (anchor: string) => string> = {
  valuation_anchor: (a) => `Is the original valuation anchor "${a}" still defensible at current peer multiples and consensus EPS?`,
  earnings_quality: (a) => `Was the memo's claim "${a}" operating-led, or distorted by other income / fair-value / one-off items?`,
  segment_driver: (a) => `Did the memo's segment claim "${a}" continue to drive the print after the memo period?`,
  margin_driver: (a) => `Did the memo's margin claim "${a}" hold, expand, or compress in the latest period?`,
  financial_claim: (a) => `Did the memo's financial claim "${a}" sustain, beat, or miss in the latest period?`,
  management_claim: (a) => `Did management subsequently confirm or weaken the memo's claim "${a}"?`,
  catalyst: (a) => `Has the memo's catalyst "${a}" played out, slipped, or been replaced?`,
  risk: (a) => `Has the memo's risk "${a}" materialized, eased, or escalated?`,
  must_verify: (a) => `Has the memo's assumption "${a}" been confirmed, weakened, or invalidated?`,
  source_gap: (a) => `Source not established in the memo for "${a}" — verify against primary sources.`,
  contradiction: (a) => `Resolve the contradiction in the memo around "${a}".`,
};

const CAT_PREFERRED_SOURCES: Record<CategoryKey, MemoUnderstandingSourcePriority[]> = {
  // Valuation tasks naturally also touch investor presentations — that's
  // where companies frame their own valuation story. Keeping investor_
  // presentation in this list also makes selectTasksForPass yield ≥1
  // task for the "investor_presentation" research pass (Phase 6A
  // mandatory case #19 preservation).
  valuation_anchor: ["market_data", "broker_notes", "investor_presentation"],
  earnings_quality: ["company_filings", "earnings_call"],
  segment_driver: ["company_filings", "earnings_call", "investor_presentation"],
  margin_driver: ["company_filings", "earnings_call"],
  financial_claim: ["company_filings", "exchange_filings"],
  management_claim: ["earnings_call", "investor_presentation"],
  catalyst: ["press", "earnings_call"],
  risk: ["press", "market_data"],
  must_verify: ["company_filings", "earnings_call"],
  source_gap: ["company_filings"],
  contradiction: ["company_filings"],
};

const CAT_EXPECTED_EVIDENCE: Record<CategoryKey, string> = {
  valuation_anchor: "Peer P/E multiple snapshot vs the memo's target multiple",
  earnings_quality: "Other-income line vs operating EBITDA in the latest results",
  segment_driver: "Segment revenue + EBITDA in the latest results filing",
  margin_driver: "Margin trajectory in the latest results print",
  financial_claim: "Reported metric in the latest results filing",
  management_claim: "Management Q&A from the latest earnings call",
  catalyst: "Press / IR confirmation of catalyst playout",
  risk: "News + market data on the risk vector",
  must_verify: "Primary source confirmation",
  source_gap: "Establish from primary sources",
  contradiction: "Reconcile against primary sources",
};

// ---- Sentence segmentation ----

interface Sentence {
  text: string;
  start: number;
  end: number;
  scores: Map<CategoryKey, number>;
  topCategory: CategoryKey | null;
  topScore: number;
}

function segmentSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  if (!text || typeof text !== "string") return out;
  // Walk the text; sentence breaks on .!? followed by whitespace OR newline.
  // Newlines also break (broker memos use bullet-like lines).
  let buf = "";
  let bufStart = -1;
  const flush = () => {
    const trimmed = buf.trim();
    if (trimmed.length >= 30 && trimmed.length <= 320) {
      // Find the actual start position of the trimmed slice within text.
      const ltrim = buf.length - buf.trimStart().length;
      const actualStart = bufStart + ltrim;
      out.push({
        text: trimmed,
        start: actualStart,
        end: actualStart + trimmed.length,
        scores: new Map(),
        topCategory: null,
        topScore: 0,
      });
    }
    buf = "";
    bufStart = -1;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (bufStart === -1 && /\S/.test(ch)) bufStart = i;
    buf += ch;
    const isTerminator = ch === "." || ch === "!" || ch === "?";
    const isNewline = ch === "\n";
    if (isTerminator) {
      const next = text[i + 1] ?? "";
      if (next === "" || /\s/.test(next)) flush();
    } else if (isNewline) {
      flush();
    }
  }
  if (buf.length > 0) flush();
  return out;
}

// ---- Scoring ----

function scoreSentences(sentences: Sentence[]): void {
  for (const sent of sentences) {
    for (const cat of CATEGORY_ORDER) {
      let score = 0;
      for (const kw of KEYWORDS[cat]) {
        if (kw.re.test(sent.text)) score += kw.weight;
      }
      // Also score management_claim (not in CATEGORY_ORDER but used as
      // a fallback hint).
      sent.scores.set(cat, score);
    }
    // Score management_claim separately.
    let mgmtScore = 0;
    for (const kw of KEYWORDS.management_claim) {
      if (kw.re.test(sent.text)) mgmtScore += kw.weight;
    }
    sent.scores.set("management_claim", mgmtScore);
    // Pick the top scoring category.
    let top: CategoryKey | null = null;
    let topScore = 0;
    for (const [cat, score] of sent.scores) {
      if (score > topScore) {
        top = cat;
        topScore = score;
      }
    }
    sent.topCategory = top;
    sent.topScore = topScore;
  }
}

// ---- Deduplication ----

function isDuplicate(candidate: string, kept: string[]): boolean {
  const candHead = candidate.slice(0, 40);
  for (const k of kept) {
    if (k.slice(0, 40) === candHead) return true;
    const candTokens = new Set(tokenize(candidate));
    const keptTokens = new Set(tokenize(k));
    if (candTokens.size === 0) continue;
    let overlap = 0;
    for (const t of candTokens) if (keptTokens.has(t)) overlap++;
    if (overlap / candTokens.size > 0.6) return true;
  }
  return false;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

// ---- Metadata regex ----

function extractRecommendation(text: string): string | undefined {
  const re = /\b(BUY|ADD|HOLD|SELL|REDUCE|NEUTRAL|OVERWEIGHT|UNDERWEIGHT|OUTPERFORM|UNDERPERFORM|MARKET[\s-]?PERFORM)\b/;
  const m = text.match(re);
  return m ? m[1] : undefined;
}

function extractTargetPrice(text: string): string | undefined {
  const re = /(?:target price|price target|\bPT\b|\bTP\b)\s*[:=]?\s*((?:INR|Rs\.?|USD|EUR|\$|₹)?\s*[\d,]+(?:\.\d+)?)/i;
  const m = text.match(re);
  return m ? m[1].trim() : undefined;
}

function extractUpside(text: string): string | undefined {
  const re = /\bupside\s*(?:of)?\s*(\d+(?:\.\d+)?\s*%)/i;
  const m = text.match(re);
  return m ? m[1].trim() : undefined;
}

function extractValuationAnchor(text: string): {
  targetMultiple?: string;
  method?: string;
} {
  const multi = text.match(/(\d+(?:\.\d+)?x)\s+(\w+['']?\d{2}[EF]?\s+EPS)/i);
  if (multi) {
    return {
      targetMultiple: `${multi[1]} ${multi[2]}`,
      method: "P/E",
    };
  }
  const pe = text.match(/\bP\/?E\b\s*(?:of|multiple)?\s*(\d+(?:\.\d+)?x?)/i);
  if (pe) {
    return { targetMultiple: pe[1], method: "P/E" };
  }
  const evEb = text.match(/\bEV\/EBITDA\b\s*(?:of|multiple)?\s*(\d+(?:\.\d+)?x?)/i);
  if (evEb) {
    return { targetMultiple: evEb[1], method: "EV/EBITDA" };
  }
  if (/\bDCF\b/.test(text)) return { method: "DCF" };
  if (/\bSOTP\b/.test(text)) return { method: "SOTP" };
  return {};
}

// ---- Numeric-value extraction for keyClaims ----

interface NumericClaim {
  metric: string;
  value: string;
  evidence: string;
  claimType: MemoUnderstandingClaimType;
}

const METRIC_PATTERNS: Array<{ metric: string; re: RegExp }> = [
  { metric: "Revenue YoY", re: /\brevenue\b[^.]*?(\d+(?:\.\d+)?\s*%)\s*YoY/i },
  { metric: "Revenue", re: /\brevenue\b[^.]*?(\d+(?:\.\d+)?\s*%)/i },
  { metric: "EBITDA margin", re: /\bEBITDA margin\b[^.]*?(\d+(?:\.\d+)?\s*%)/i },
  { metric: "EBITDA growth", re: /\bEBITDA\b[^.]*?(\d+(?:\.\d+)?\s*%)/i },
  { metric: "PAT growth", re: /\bPAT\b[^.]*?(\d+(?:\.\d+)?\s*%)/i },
  { metric: "EPS", re: /\bEPS\b[^.]*?(INR\s*[\d.]+|Rs[. ]*\d+(?:\.\d+)?|\d+(?:\.\d+)?)/i },
  { metric: "Gross margin", re: /\bgross margin\b[^.]*?(\d+(?:\.\d+)?\s*%)/i },
  { metric: "Operating margin", re: /\boperating margin\b[^.]*?(\d+(?:\.\d+)?\s*%)/i },
  { metric: "Sales growth", re: /\bsales\b[^.]*?(\d+(?:\.\d+)?\s*%)/i },
];

function detectClaimType(sentence: string): MemoUnderstandingClaimType {
  if (/\b(estimate|estimated)\b/i.test(sentence)) return "estimate";
  if (/\b(forecast|forecasted)\b/i.test(sentence)) return "forecast";
  if (/\b(guidance|guided)\b/i.test(sentence)) return "guidance";
  if (/\b(assume|assumption)\b/i.test(sentence)) return "assumption";
  return "reported";
}

function extractNumericClaims(sentences: Sentence[]): NumericClaim[] {
  const out: NumericClaim[] = [];
  const seenMetrics = new Set<string>();
  for (const sent of sentences) {
    for (const pattern of METRIC_PATTERNS) {
      if (seenMetrics.has(pattern.metric)) continue;
      const m = sent.text.match(pattern.re);
      if (m && m[1]) {
        seenMetrics.add(pattern.metric);
        out.push({
          metric: pattern.metric,
          value: m[1].trim(),
          evidence: sent.text,
          claimType: detectClaimType(sent.text),
        });
        if (out.length >= 6) return out;
      }
    }
  }
  return out;
}

// ---- Public builder ----

const MAX_FLAGS = 5;
const MAX_PILLARS = 5;
const MAX_SEGMENT_CLAIMS = 4;
const MAX_TASKS = 8;
const MIN_TASKS = 5;
const MAX_LIST = 4;

export function buildBaselineMemoUnderstanding(
  args: BuildBaselineArgs,
): MemoUnderstanding {
  const text = args.extractedText ?? "";
  const sentences = segmentSentences(text);
  scoreSentences(sentences);

  // Per-category top sentences (post-dedup).
  const byCategory = new Map<CategoryKey, Sentence[]>();
  for (const cat of CATEGORY_ORDER) {
    const sorted = sentences
      .filter((s) => (s.scores.get(cat) ?? 0) > 0)
      .sort((a, b) => (b.scores.get(cat) ?? 0) - (a.scores.get(cat) ?? 0));
    const kept: Sentence[] = [];
    const keptTexts: string[] = [];
    for (const s of sorted) {
      if (kept.length >= 4) break;
      if (isDuplicate(s.text, keptTexts)) continue;
      kept.push(s);
      keptTexts.push(s.text);
    }
    byCategory.set(cat, kept);
  }

  // ---- Flags ----
  // Phase 6D: round-robin across categories so a single dominant category
  // (e.g. valuation_anchor) cannot grab every flag slot with near-identical
  // sentences. Pass 1 takes the TOP sentence from each category in
  // CATEGORY_ORDER. Pass 2 fills any remaining slots with the next-best
  // sentence from each category. Within a category, isDuplicate already
  // prevents near-matches.
  const flags: MemoUnderstandingFlaggedDetail[] = [];
  const usedSentenceStarts = new Set<number>();
  let flagSeq = 1;
  const PER_CAT_BUDGET = 2;
  outer: for (let depth = 0; depth < PER_CAT_BUDGET; depth++) {
    for (const cat of CATEGORY_ORDER) {
      if (flags.length >= MAX_FLAGS) break outer;
      const list = byCategory.get(cat) ?? [];
      const s = list[depth];
      if (!s) continue;
      if (usedSentenceStarts.has(s.start)) continue;
      const id = `bfd${String(flagSeq).padStart(2, "0")}`;
      flagSeq += 1;
      const label = makeLabel(cat, s.text);
      flags.push({
        id,
        label,
        detail: truncate(s.text, 200),
        category: cat,
        importance: CAT_TO_IMPORTANCE[cat],
        whyItMatters: makeWhyItMatters(cat, s.text),
        memoEvidence: truncate(s.text, 200),
        researchQuestion: CAT_QUESTION_TEMPLATE[cat](label),
      });
      usedSentenceStarts.add(s.start);
    }
  }

  // ---- Pillars ----
  const pillars: MemoUnderstandingThesisPillar[] = [];
  let pillarSeq = 1;
  if (args.dna && args.dna.thesisCheckpoints && args.dna.thesisCheckpoints.length > 0) {
    for (const cp of args.dna.thesisCheckpoints.slice(0, MAX_PILLARS)) {
      pillars.push({
        id: `btp${String(pillarSeq).padStart(2, "0")}`,
        label: truncate(cp.label, 140),
        originalClaim: truncate(cp.rationale || cp.label, 240),
        evidenceFromMemo: truncate(cp.rationale || cp.label, 200),
        importance: "high",
        needsResearch: true,
        researchPriority: pillarSeq <= 2 ? "must_check" : "important",
      });
      pillarSeq += 1;
    }
  }
  if (pillars.length < 3) {
    // Backfill from segment/margin/financial snippets.
    const fillCats: CategoryKey[] = ["segment_driver", "margin_driver", "financial_claim", "earnings_quality"];
    for (const cat of fillCats) {
      if (pillars.length >= MAX_PILLARS) break;
      const list = byCategory.get(cat) ?? [];
      for (const s of list) {
        if (pillars.length >= MAX_PILLARS) break;
        const label = makeLabel(cat, s.text);
        // Skip if this label already appears.
        if (pillars.some((p) => p.label === label)) continue;
        pillars.push({
          id: `btp${String(pillarSeq).padStart(2, "0")}`,
          label,
          originalClaim: truncate(s.text, 240),
          evidenceFromMemo: truncate(s.text, 200),
          importance: "high",
          needsResearch: true,
          researchPriority: pillarSeq <= 2 ? "must_check" : "important",
        });
        pillarSeq += 1;
      }
    }
  }

  // ---- Key claims (numeric extraction) ----
  const numericClaims = extractNumericClaims(sentences);
  const keyClaims: MemoUnderstandingFinancialClaim[] = numericClaims.map((nc, i) => ({
    id: `bfc${String(i + 1).padStart(2, "0")}`,
    metric: nc.metric,
    value: nc.value,
    claimType: nc.claimType,
    whyItMatters: `Matters for updating the memo because ${nc.metric} drives the memo's quantitative thesis.`,
    researchQuestion: `Did ${nc.metric} (${nc.value} in the memo) sustain, beat, or miss in the latest period?`,
  }));

  // ---- Segment claims (use top segment_driver sentences with numeric anchors) ----
  const segmentClaims: MemoUnderstandingSegmentClaim[] = [];
  const segmentDriverSentences = byCategory.get("segment_driver") ?? [];
  let segSeq = 1;
  for (const s of segmentDriverSentences) {
    if (segmentClaims.length >= MAX_SEGMENT_CLAIMS) break;
    const segMatch = s.text.match(/\b(C&W|Lloyd|ECD|RAC|cables|wires|switchgear|lighting)\b/i);
    if (!segMatch) continue;
    const num = s.text.match(/(\d+(?:\.\d+)?\s*%|\d+bps|\d+\s*bps)/);
    segmentClaims.push({
      id: `bsc${String(segSeq).padStart(2, "0")}`,
      segment: segMatch[1],
      claim: truncate(s.text, 240),
      importance: "high",
      researchQuestion: `Did the ${segMatch[1]} segment continue to drive the print after the memo period?`,
      ...(num ? { value: num[1].trim() } : {}),
    });
    segSeq += 1;
  }

  // ---- Metadata ----
  const recommendation = extractRecommendation(text);
  const targetPrice = extractTargetPrice(text);
  const upside = extractUpside(text);
  const valuationAnchor = extractValuationAnchor(text);

  // ---- Summary ----
  const topValSentence = (byCategory.get("valuation_anchor") ?? [])[0];
  const topFinSentence = (byCategory.get("financial_claim") ?? [])[0];
  const topRiskSentence = (byCategory.get("risk") ?? [])[0];
  const recommendationWord = recommendation ? recommendation : "Buy";
  const oneLineSummary = `${capitalize(recommendationWord.toLowerCase())} thesis on ${args.companyName} anchored on the memo's specific claims.`;
  const shortSummaryParts: string[] = [];
  if (topValSentence) shortSummaryParts.push(truncate(topValSentence.text, 200));
  if (topFinSentence && topFinSentence.start !== topValSentence?.start) {
    shortSummaryParts.push(truncate(topFinSentence.text, 200));
  }
  const shortSummary = truncate(shortSummaryParts.join(" "), 600);
  const originalThesis = truncate(args.dna?.originalThesis ?? shortSummary, 600);

  const needsToBeRight = mapSentenceHeads(
    [
      ...(byCategory.get("segment_driver") ?? []),
      ...(byCategory.get("margin_driver") ?? []),
      ...(byCategory.get("financial_claim") ?? []),
    ],
    MAX_LIST,
  );
  const wouldChangeTheView = mapSentenceHeads(byCategory.get("risk") ?? [], MAX_LIST);

  // ---- Research tasks ----
  const tasks: MemoUnderstandingResearchTask[] = [];
  let taskSeq = 1;
  for (const flag of flags) {
    if (tasks.length >= MAX_TASKS) break;
    tasks.push({
      id: `brt${String(taskSeq).padStart(2, "0")}`,
      label: truncate(flag.label, 80),
      question: flag.researchQuestion,
      memoAnchor: truncate(flag.label, 160),
      linkedFlagIds: [flag.id],
      linkedPillarIds: [],
      linkedFinancialClaimIds: [],
      preferredSources: CAT_PREFERRED_SOURCES[flag.category],
      expectedEvidence: CAT_EXPECTED_EVIDENCE[flag.category],
      priority:
        flag.importance === "critical" || flag.importance === "high"
          ? "must_check"
          : "important",
    });
    taskSeq += 1;
  }
  // Backfill from pillars if we have fewer than MIN_TASKS.
  for (const p of pillars) {
    if (tasks.length >= MIN_TASKS) break;
    if (tasks.some((t) => t.memoAnchor === p.label)) continue;
    tasks.push({
      id: `brt${String(taskSeq).padStart(2, "0")}`,
      label: truncate(p.label, 80),
      question: `Did the memo's pillar "${p.label}" hold after the memo period?`,
      memoAnchor: truncate(p.label, 160),
      linkedFlagIds: [],
      linkedPillarIds: [p.id],
      linkedFinancialClaimIds: [],
      preferredSources: ["company_filings", "earnings_call"],
      expectedEvidence: "Pillar confirmation in the latest results",
      priority: "must_check",
    });
    taskSeq += 1;
  }

  // ---- Catalysts / Risks / Watch ----
  const catalystSentences = byCategory.get("catalyst") ?? [];
  const catalysts = mapSentenceHeads(catalystSentences, MAX_LIST);
  const riskSentences = byCategory.get("risk") ?? [];
  const risks = mapSentenceHeads(riskSentences, MAX_LIST);
  const watchSentences = byCategory.get("must_verify") ?? [];
  const watchItems = mapSentenceHeads(watchSentences, MAX_LIST);

  // ---- Confidence ----
  const flagCount = flags.length;
  const pillarCount = pillars.length;
  const hasRecommendation = recommendation !== undefined;
  const extractionConfidence: "low" | "medium" =
    flagCount >= 3 && pillarCount >= 3 && hasRecommendation ? "medium" : "low";

  const missingFromMemo = [
    `Recovered deterministically after LLM structured-output failure (reason: ${args.recoveryReason}).`,
  ];
  if (!hasRecommendation) missingFromMemo.push("Recommendation not detected in memo.");
  if (!targetPrice) missingFromMemo.push("Target price not detected in memo.");
  if (!valuationAnchor.targetMultiple && !valuationAnchor.method) {
    missingFromMemo.push("Valuation framework not detected in memo.");
  }

  const ambiguousItems: string[] = [];
  if (topValSentence && (topValSentence.scores.get("valuation_anchor") ?? 0) < 5) {
    ambiguousItems.push("Valuation anchor classification was low-confidence.");
  }

  // ---- mustAnswerQuestions ----
  const mustAnswerQuestions = tasks.slice(0, 4).map((t) => t.question);

  // ---- Assemble ----
  const memo: MemoUnderstanding = {
    projectId: args.projectId,
    company: {
      detectedName: args.companyName,
      aliases: [],
      ...(args.ticker ? { ticker: args.ticker } : {}),
    },
    memo: {
      ...(recommendation ? { recommendation } : {}),
      ...(targetPrice ? { targetPrice } : {}),
      ...(upside ? { upsideAtMemo: upside } : {}),
      ...(args.detection?.periodLabel ? { periodCovered: args.detection.periodLabel } : {}),
    },
    summary: {
      oneLineSummary,
      shortSummary,
      originalThesis,
      whatTheMemoNeedsToBeRight: needsToBeRight,
      whatWouldChangeTheView: wouldChangeTheView,
    },
    flaggedDetails: flags,
    thesis: {
      oneLineThesis: oneLineSummary,
      detailedThesis: shortSummary,
      thesisPillars: pillars,
    },
    financials: { keyClaims, segmentClaims },
    valuation: {
      ...(valuationAnchor.method ? { method: valuationAnchor.method } : {}),
      ...(valuationAnchor.targetMultiple ? { targetMultiple: valuationAnchor.targetMultiple } : {}),
      ...(targetPrice ? { targetPrice } : {}),
      ...(upside ? { upside } : {}),
      keyValuationAssumptions: mapSentenceHeads(byCategory.get("valuation_anchor") ?? [], 2),
      valuationQuestionsToUpdate: flags
        .filter((f) => f.category === "valuation_anchor")
        .map((f) => f.researchQuestion)
        .slice(0, 4),
    },
    risksAndCatalysts: { catalysts, risks, watchItems },
    researchPlan: {
      mustAnswerQuestions,
      sourcePriorities: [
        "company_filings",
        "exchange_filings",
        "earnings_call",
        "investor_presentation",
        "broker_notes",
      ],
      researchTasks: tasks.slice(0, MAX_TASKS),
    },
    confidence: {
      extractionConfidence,
      missingFromMemo,
      ambiguousItems,
    },
  };

  // Use topRiskSentence reference (silence unused if ever unused).
  void topRiskSentence;

  return memo;
}

// ---- Pure helpers ----

function makeLabel(cat: CategoryKey, text: string): string {
  // Phase 6D: ALWAYS produce a specific label. The category prefix is
  // kept for visual grouping, but the suffix must be a distinguishing
  // phrase lifted from the sentence so two flags in the same category
  // never render identically.
  const prefix = CATEGORY_PREFIX[cat];
  const suffix = labelSuffix(cat, text);
  if (suffix) return `${prefix} — ${suffix}`;
  // Last-resort fallback: lift the first noun-phrase-looking chunk of
  // the sentence so the row is still distinctive.
  const head = liftHead(text, 60);
  return head ? `${prefix} — ${head}` : prefix;
}

const CATEGORY_PREFIX: Record<CategoryKey, string> = {
  valuation_anchor: "Valuation anchor",
  earnings_quality: "Earnings quality",
  segment_driver: "Segment driver",
  margin_driver: "Margin driver",
  financial_claim: "Financial claim",
  management_claim: "Management claim",
  catalyst: "Catalyst",
  risk: "Risk",
  must_verify: "Must verify",
  source_gap: "Source gap",
  contradiction: "Contradiction",
};

// Try category-specific patterns to lift a distinguishing phrase from
// the sentence. Returns undefined when nothing strong matches — the
// caller will fall back to liftHead().
function labelSuffix(cat: CategoryKey, text: string): string | undefined {
  switch (cat) {
    case "valuation_anchor": {
      const m =
        text.match(/(\d+(?:\.\d+)?x\s+\w+['']?\d{2}[EF]?\s+EPS)/i) ||
        text.match(/(\d+(?:\.\d+)?x\s+(?:P\/?E|EV\/EBITDA))/i) ||
        text.match(/((?:P\/?E|EV\/EBITDA|P\/B)\s*(?:of|multiple)?\s*\d+(?:\.\d+)?x?)/i);
      if (m) return truncate(m[1], 100);
      const tp = text.match(/target price[^,.;]*/i);
      if (tp) return truncate(tp[0], 100);
      const pt = text.match(/price target[^,.;]*/i);
      if (pt) return truncate(pt[0], 100);
      const upside = text.match(/upside[^,.;]*/i);
      if (upside) return truncate(upside[0], 100);
      if (/\bDCF\b/i.test(text)) return "DCF anchor";
      if (/\bSOTP\b/i.test(text)) return "SOTP anchor";
      return undefined;
    }
    case "earnings_quality": {
      const m =
        text.match(/(other income[^,.;]{0,80})/i) ||
        text.match(/(fair value[^,.;]{0,80})/i) ||
        text.match(/(one[- ]off[^,.;]{0,80})/i) ||
        text.match(/(non[- ]recurring[^,.;]{0,80})/i) ||
        text.match(/(exceptional[^,.;]{0,80})/i) ||
        text.match(/(below[- ]the[- ]line[^,.;]{0,80})/i) ||
        text.match(/(core EBITDA[^,.;]{0,80})/i);
      return m ? truncate(m[1], 100) : undefined;
    }
    case "segment_driver": {
      const segMatch = text.match(
        /\b(C&W|Lloyd|ECD|RAC|cables|wires|switchgear|lighting)\b[^,.;]{0,80}/i,
      );
      if (segMatch) return truncate(segMatch[0], 100);
      const generic = text.match(/(segment[^,.;]{0,80})/i);
      return generic ? truncate(generic[1], 100) : undefined;
    }
    case "margin_driver": {
      const m =
        text.match(/((?:EBITDA|EBIT|gross|operating) margin[^,.;]{0,80})/i) ||
        text.match(/(margin (?:compression|expansion)[^,.;]{0,80})/i);
      return m ? truncate(m[1], 100) : undefined;
    }
    case "financial_claim": {
      const m =
        text.match(/((?:revenue|sales|EBITDA|EBIT|PAT|EPS)[^,.;]{0,80})/i);
      return m ? truncate(m[1], 100) : undefined;
    }
    case "management_claim": {
      const m =
        text.match(/((?:guidance|guided|commentary|management said|management stated)[^,.;]{0,80})/i);
      return m ? truncate(m[1], 100) : undefined;
    }
    case "catalyst": {
      const m =
        text.match(/((?:catalyst|re[- ]rating|trigger|capacity|expansion)[^,.;]{0,80})/i);
      return m ? truncate(m[1], 100) : undefined;
    }
    case "risk": {
      const m =
        text.match(/((?:risk|slowdown|inventory|channel|pricing|input cost|headwind|regulatory)[^,.;]{0,80})/i);
      return m ? truncate(m[1], 100) : undefined;
    }
    case "must_verify": {
      const m =
        text.match(/((?:assume|assumption|forecast|estimate|expect)[^,.;]{0,80})/i);
      return m ? truncate(m[1], 100) : undefined;
    }
    case "source_gap":
    case "contradiction":
      return undefined;
  }
}

// Lift a short head phrase from the sentence — used as the absolute
// last-resort label suffix so two flags in the same category still
// render distinctly.
function liftHead(text: string, max: number): string {
  if (!text) return "";
  // Take the first clause (up to the first comma/semicolon/dash) then
  // truncate.
  const firstClause = text.split(/[,;—–]/)[0] ?? text;
  const cleaned = firstClause.trim().replace(/\s+/g, " ");
  return truncate(cleaned, max);
}

// Phase 6D: make the visible "why it matters" mention the specific
// excerpt from the sentence, rather than repeating a static
// category-level reason word-for-word across multiple flags in the
// same category. The category-level reason stays as the prefix so the
// framing remains consistent.
function makeWhyItMatters(cat: CategoryKey, text: string): string {
  const generic = CAT_WHY[cat];
  const specific = labelSuffix(cat, text) || liftHead(text, 80);
  if (!specific) return generic;
  // Prepend the specific anchor in italics-style framing (rendered as
  // plain text in the UI). The generic clause provides the rationale.
  return `Specifically: "${specific}". ${generic}`;
}

function mapSentenceHeads(sentences: Sentence[], cap: number): string[] {
  const out: string[] = [];
  for (const s of sentences) {
    if (out.length >= cap) break;
    out.push(truncate(s.text, 200));
  }
  return out;
}

function truncate(value: string, max: number): string {
  if (typeof value !== "string") return "";
  const s = value.trim();
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value[0].toUpperCase() + value.slice(1);
}
