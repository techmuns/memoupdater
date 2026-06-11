import { trimToCharBudget } from "../llm/trim";

// Phase 6A: section-aware intelligent trim for /api/memo/understand input.
// Cap: 32 000 chars. Algorithm:
//   1. < cap → return verbatim.
//   2. Detect section headings via case-insensitive line-anchored regex.
//   3. Always include the doc head up to the first heading (capped at
//      2 000 chars) — covers title / broker / date / recommendation.
//   4. Greedy fill the remaining budget by section priority. Higher-tier
//      sections (Investment Thesis / Valuation / Risks / Conclusion /
//      Summary) win first; second-tier (Financials / Segment / Catalysts /
//      Recommendation) next; lowest-tier (Q&A / Outlook) last.
//   5. Fallback (≤2 headings detected) → head + middle + tail sample via
//      the existing trimToCharBudget helper (Phase 5C).
//   6. NEVER fabricate content; joiners only — every preserved range is a
//      verbatim slice of the input.

export const UNDERSTAND_INPUT_CHAR_CAP = 32_000;
const HEAD_BUDGET = 2_000;
const SECTION_JOINER = "\n\n[... section omitted for length ...]\n\n";

// Section-priority tiers (higher index in earlier arrays = win first).
const PRIORITY_TIERS: ReadonlyArray<readonly RegExp[]> = [
  // Tier 1 — thesis spine
  [
    /^(\s*\d+[.)]?\s*)?(investment thesis|thesis|executive summary|summary)\s*:?\s*$/i,
    /^(\s*\d+[.)]?\s*)?(valuation|target price|price target|recommendation|conclusion|key takeaways)\s*:?\s*$/i,
    /^(\s*\d+[.)]?\s*)?(risk(s| factors)?)\s*:?\s*$/i,
  ],
  // Tier 2 — supporting evidence
  [
    /^(\s*\d+[.)]?\s*)?(financial(s| highlights| summary| performance)?)\s*:?\s*$/i,
    /^(\s*\d+[.)]?\s*)?(segment(s| review| analysis)?)\s*:?\s*$/i,
    /^(\s*\d+[.)]?\s*)?(catalyst(s)?)\s*:?\s*$/i,
    /^(\s*\d+[.)]?\s*)?(management|company overview|business overview)\s*:?\s*$/i,
  ],
  // Tier 3 — color
  [
    /^(\s*\d+[.)]?\s*)?(outlook|guidance)\s*:?\s*$/i,
    /^(\s*\d+[.)]?\s*)?(q ?& ?a|questions? and answers?)\s*:?\s*$/i,
    /^(\s*\d+[.)]?\s*)?(notes?|appendix|disclosures?)\s*:?\s*$/i,
  ],
];

interface DetectedSection {
  headingLine: number;
  start: number;
  end: number;
  tier: 0 | 1 | 2;
}

export interface TrimForUnderstandingResult {
  text: string;
  inputLen: number;
  outputLen: number;
  sectionsKept: number;
  fallbackUsed: boolean;
}

export function trimForUnderstanding(
  text: string,
  cap: number = UNDERSTAND_INPUT_CHAR_CAP,
): TrimForUnderstandingResult {
  if (typeof text !== "string") {
    return { text: "", inputLen: 0, outputLen: 0, sectionsKept: 0, fallbackUsed: false };
  }
  const inputLen = text.length;
  if (inputLen <= cap) {
    return {
      text,
      inputLen,
      outputLen: inputLen,
      sectionsKept: 0,
      fallbackUsed: false,
    };
  }

  const detected = detectSections(text);
  if (detected.length <= 2) {
    // Fallback: head + middle + tail via the existing Phase 5C helper.
    const fallbackText = trimToCharBudget(text, cap);
    return {
      text: fallbackText,
      inputLen,
      outputLen: fallbackText.length,
      sectionsKept: 0,
      fallbackUsed: true,
    };
  }

  // Always include the doc head up to the first detected heading,
  // capped at HEAD_BUDGET.
  const firstHeadingStart = detected[0].start;
  const headSlice = text.slice(
    0,
    Math.min(firstHeadingStart, HEAD_BUDGET),
  );
  let remainingBudget = Math.max(0, cap - headSlice.length - SECTION_JOINER.length);

  // Greedy fill by tier, then by appearance order within tier.
  const keepers: DetectedSection[] = [];
  for (let tier = 0 as 0 | 1 | 2; tier <= 2; tier = ((tier + 1) as 0 | 1 | 2)) {
    for (const section of detected) {
      if (section.tier !== tier) continue;
      const len = section.end - section.start;
      if (len + SECTION_JOINER.length > remainingBudget) continue;
      keepers.push(section);
      remainingBudget -= len + SECTION_JOINER.length;
    }
    if (tier === 2) break;
  }

  // Sort keepers by original document order so the trimmed output reads
  // left-to-right.
  keepers.sort((a, b) => a.start - b.start);

  const pieces: string[] = [headSlice];
  let lastEnd = headSlice.length;
  for (const section of keepers) {
    if (section.start < lastEnd) continue;
    if (section.start > lastEnd) pieces.push(SECTION_JOINER);
    pieces.push(text.slice(section.start, section.end));
    lastEnd = section.end;
  }
  // Tail joiner if anything follows the last keeper.
  if (lastEnd < inputLen) pieces.push(SECTION_JOINER);

  const out = pieces.join("");
  return {
    text: out,
    inputLen,
    outputLen: out.length,
    sectionsKept: keepers.length,
    fallbackUsed: false,
  };
}

function detectSections(text: string): DetectedSection[] {
  const lines = text.split("\n");
  const all: DetectedSection[] = [];
  let charCursor = 0;
  const lineStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    lineStarts.push(charCursor);
    charCursor += lines[i].length + 1; // +1 for the \n
  }
  const headings: Array<{ lineIdx: number; tier: 0 | 1 | 2 }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0 || line.length > 80) continue;
    const tier = matchTier(line);
    if (tier !== null) {
      headings.push({ lineIdx: i, tier });
    }
  }
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const next = headings[i + 1];
    const start = lineStarts[h.lineIdx];
    const end = next ? lineStarts[next.lineIdx] : text.length;
    all.push({ headingLine: h.lineIdx, start, end, tier: h.tier });
  }
  return all;
}

function matchTier(line: string): 0 | 1 | 2 | null {
  for (let tier = 0; tier <= 2; tier++) {
    const patterns = PRIORITY_TIERS[tier];
    for (const re of patterns) {
      if (re.test(line)) return tier as 0 | 1 | 2;
    }
  }
  return null;
}
