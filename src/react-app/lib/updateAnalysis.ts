import type {
  DocumentKind,
  DocumentSourceSnippet,
  ExtractionResult,
  LocalUploadedFile,
  SignalPolarity,
  UpdatePackAnalysis,
  UpdateSignal,
  UpdateSignalCategory,
} from "@shared/types";
import { splitSentences } from "./text";

// ---------- Public API ----------

export interface UpdateAnalysisInput {
  extractions: Partial<Record<DocumentKind, ExtractionResult>>;
  uploads: Partial<Record<DocumentKind, LocalUploadedFile>>;
}

export const DOCUMENT_KINDS: readonly DocumentKind[] = [
  "financials",
  "management_commentary",
  "broker_notes",
  "competitor_notes",
  "macro_notes",
  "market_data",
];

const CATEGORY_ORDER: readonly UpdateSignalCategory[] = [
  "financial_growth",
  "margin",
  "guidance",
  "management",
  "ma_integration",
  "recurring_quality",
  "valuation",
  "ai_macro_competitive",
  "unresolved_question",
];

// ---------- Signal dictionary ----------

interface UpdateSignalDef {
  phrase: string;
  pattern: RegExp;
  category: UpdateSignalCategory;
  polarity: SignalPolarity;
  weight: number;
}

const s = (
  phrase: string,
  category: UpdateSignalCategory,
  polarity: SignalPolarity,
  weight = 1,
): UpdateSignalDef => ({
  phrase,
  pattern: new RegExp(
    `\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "i",
  ),
  category,
  polarity,
  weight,
});

const UPDATE_SIGNALS: UpdateSignalDef[] = [
  // financial_growth — positives
  s("beat consensus", "financial_growth", "positive", 2),
  s("above consensus", "financial_growth", "positive", 2),
  s("ahead of estimates", "financial_growth", "positive", 2),
  s("revenue beat", "financial_growth", "positive", 2),
  s("EBITDA beat", "financial_growth", "positive", 2),
  s("EPS beat", "financial_growth", "positive", 2),
  s("growth accelerated", "financial_growth", "positive", 2),
  s("accelerating growth", "financial_growth", "positive", 2),
  s("record quarter", "financial_growth", "positive", 2),
  s("strong quarter", "financial_growth", "positive", 1),
  s("topped expectations", "financial_growth", "positive", 2),
  // financial_growth — negatives
  s("missed consensus", "financial_growth", "negative", 2),
  s("below consensus", "financial_growth", "negative", 2),
  s("revenue miss", "financial_growth", "negative", 2),
  s("EBITDA miss", "financial_growth", "negative", 2),
  s("EPS miss", "financial_growth", "negative", 2),
  s("growth decelerated", "financial_growth", "negative", 2),
  s("decelerating growth", "financial_growth", "negative", 2),
  s("slowdown", "financial_growth", "negative", 1),
  s("disappointing quarter", "financial_growth", "negative", 2),
  s("weaker than expected", "financial_growth", "negative", 2),

  // margin — positives
  s("margin expansion", "margin", "positive", 2),
  s("margins expanded", "margin", "positive", 2),
  s("operating leverage", "margin", "positive", 2),
  s("gross margin improvement", "margin", "positive", 2),
  s("margins improved", "margin", "positive", 2),
  s("cost discipline", "margin", "positive", 1),
  // margin — negatives
  s("margin compression", "margin", "negative", 2),
  s("margin pressure", "margin", "negative", 2),
  s("margins contracted", "margin", "negative", 2),
  s("cost overrun", "margin", "negative", 2),
  s("rising opex", "margin", "negative", 1),
  s("operating deleverage", "margin", "negative", 2),

  // guidance — positives
  s("raised guidance", "guidance", "positive", 3),
  s("guidance raised", "guidance", "positive", 3),
  s("reaffirmed guidance", "guidance", "positive", 1),
  s("upgraded outlook", "guidance", "positive", 2),
  s("upbeat outlook", "guidance", "positive", 1),
  // guidance — negatives
  s("cut guidance", "guidance", "negative", 3),
  s("guidance cut", "guidance", "negative", 3),
  s("lowered guidance", "guidance", "negative", 3),
  s("withdrew guidance", "guidance", "negative", 3),
  s("downgraded outlook", "guidance", "negative", 2),

  // management — positives
  s("on track", "management", "positive", 1),
  s("disciplined capital allocation", "management", "positive", 2),
  s("capital return framework", "management", "positive", 2),
  s("buyback", "management", "positive", 2),
  s("share repurchase", "management", "positive", 2),
  s("dividend increase", "management", "positive", 2),
  // management — negatives
  s("delay", "management", "negative", 1),
  s("delayed", "management", "negative", 1),
  s("attrition", "management", "negative", 2),
  s("executive departure", "management", "negative", 2),
  s("CFO departure", "management", "negative", 3),
  s("CEO departure", "management", "negative", 3),
  s("resignation", "management", "negative", 2),

  // ma_integration — positives
  s("integration on track", "ma_integration", "positive", 2),
  s("synergy realization", "ma_integration", "positive", 2),
  s("synergies on track", "ma_integration", "positive", 2),
  s("accretive acquisition", "ma_integration", "positive", 2),
  // ma_integration — negatives
  s("integration delay", "ma_integration", "negative", 2),
  s("dilutive acquisition", "ma_integration", "negative", 2),
  s("goodwill impairment", "ma_integration", "negative", 3),
  s("write-down", "ma_integration", "negative", 2),

  // recurring_quality — positives
  s("ARR growth", "recurring_quality", "positive", 2),
  s("ARR accelerated", "recurring_quality", "positive", 2),
  s("net revenue retention", "recurring_quality", "positive", 1),
  s("retention improved", "recurring_quality", "positive", 2),
  s("gross retention", "recurring_quality", "positive", 1),
  s("cross-sell", "recurring_quality", "positive", 1),
  // recurring_quality — negatives
  s("churn rose", "recurring_quality", "negative", 2),
  s("churn increased", "recurring_quality", "negative", 2),
  s("retention declined", "recurring_quality", "negative", 2),
  s("NRR slipped", "recurring_quality", "negative", 2),
  s("retention slipped", "recurring_quality", "negative", 2),

  // valuation — positives
  s("upside", "valuation", "positive", 1),
  s("upgrade", "valuation", "positive", 2),
  s("target raised", "valuation", "positive", 2),
  s("re-rate", "valuation", "positive", 2),
  s("re-rating", "valuation", "positive", 2),
  s("trading below intrinsic value", "valuation", "positive", 2),
  // valuation — negatives
  s("downside", "valuation", "negative", 1),
  s("downgrade", "valuation", "negative", 2),
  s("target cut", "valuation", "negative", 2),
  s("de-rate", "valuation", "negative", 2),
  s("de-rating", "valuation", "negative", 2),
  s("multiple compression", "valuation", "negative", 2),
  s("overvalued", "valuation", "negative", 2),
  // valuation — neutral anchors (no polarity bias)
  s("P/E", "valuation", "neutral", 1),
  s("EV/Sales", "valuation", "neutral", 1),
  s("EV/EBITDA", "valuation", "neutral", 1),
  s("peer multiple", "valuation", "neutral", 1),

  // ai_macro_competitive — positives
  s("share gain", "ai_macro_competitive", "positive", 2),
  s("market share gain", "ai_macro_competitive", "positive", 2),
  s("pricing power", "ai_macro_competitive", "positive", 2),
  s("competitive moat", "ai_macro_competitive", "positive", 2),
  // ai_macro_competitive — negatives
  s("disintermediation", "ai_macro_competitive", "negative", 3),
  s("headwind", "ai_macro_competitive", "negative", 1),
  s("FX strength", "ai_macro_competitive", "negative", 1),
  s("demand normalization", "ai_macro_competitive", "negative", 1),
  s("share loss", "ai_macro_competitive", "negative", 2),
  s("price competition", "ai_macro_competitive", "negative", 2),

  // unresolved_question — neutral (caller will tag separately)
  s("open question", "unresolved_question", "neutral", 1),
  s("remains unclear", "unresolved_question", "neutral", 1),
  s("to watch", "unresolved_question", "neutral", 1),
];

// ---------- Snippet helper ----------

export function buildSnippet(args: {
  sentence: string;
  documentId: string;
  kind: DocumentKind;
  maxChars?: number;
}): DocumentSourceSnippet {
  const { sentence, documentId, kind } = args;
  const maxChars = args.maxChars ?? 200;
  const collapsed = sentence.replace(/\s+/g, " ").trim();
  let quote = collapsed;
  if (collapsed.length > maxChars) {
    const cut = collapsed.slice(0, maxChars);
    const lastSpace = cut.lastIndexOf(" ");
    quote =
      (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut) + "…";
  }
  return { documentId, kind, quote };
}

// ---------- Negation guard ----------

const NEGATION_TOKENS = /\b(not|no|didn't|did not|hasn't|has not|haven't|have not|wasn't|was not|weren't|were not|never|fails to|failed to)\b/i;

function looksNegated(sentence: string, phraseIndex: number): boolean {
  const windowStart = Math.max(0, phraseIndex - 60);
  const window = sentence.slice(windowStart, phraseIndex);
  return NEGATION_TOKENS.test(window);
}

function flipPolarity(p: SignalPolarity): SignalPolarity {
  if (p === "positive") return "negative";
  if (p === "negative") return "positive";
  return "neutral";
}

// ---------- Main entry ----------

export function analyzeUpdatePack(
  input: UpdateAnalysisInput,
): UpdatePackAnalysis {
  const { extractions, uploads } = input;
  const documentsAnalyzed: DocumentKind[] = [];
  const unsupportedDocuments: DocumentKind[] = [];
  const collected: UpdateSignal[] = [];

  for (const kind of DOCUMENT_KINDS) {
    const upload = uploads[kind];
    if (!upload) continue; // missing slot — not unsupported, just absent

    const extraction = extractions[kind];
    const usable =
      extraction !== undefined &&
      (extraction.status === "success" || extraction.status === "partial") &&
      extraction.text.trim().length > 0;

    if (!usable) {
      unsupportedDocuments.push(kind);
      continue;
    }

    documentsAnalyzed.push(kind);
    const sentences = splitSentences(extraction.text);
    const perCategoryCount = new Map<UpdateSignalCategory, number>();
    let totalForKind = 0;

    for (let i = 0; i < sentences.length; i++) {
      if (totalForKind >= 12) break;
      const sentence = sentences[i];
      // First matching def wins per sentence — preserves dictionary order.
      for (const def of UPDATE_SIGNALS) {
        const m = sentence.match(def.pattern);
        if (!m || m.index === undefined) continue;

        const capPerCat = perCategoryCount.get(def.category) ?? 0;
        if (capPerCat >= 4) break;

        const negated = looksNegated(sentence, m.index);
        const polarity = negated ? flipPolarity(def.polarity) : def.polarity;

        const index = collected.length;
        collected.push({
          id: `sig_${def.category}_${kind}_${index}`,
          category: def.category,
          polarity,
          phrase: def.phrase,
          weight: def.weight,
          documentKind: kind,
          source: buildSnippet({
            sentence,
            documentId: upload.id,
            kind,
          }),
        });
        perCategoryCount.set(def.category, capPerCat + 1);
        totalForKind++;
        break;
      }
    }

    // Question-mark / heading sweep for unresolved_question.
    let unresolvedAdded = 0;
    for (let i = 0; i < sentences.length && unresolvedAdded < 3; i++) {
      const sentence = sentences[i];
      if (!/[?]\s*$/.test(sentence)) continue;
      const capPerCat = perCategoryCount.get("unresolved_question") ?? 0;
      if (capPerCat >= 4) break;
      const index = collected.length;
      collected.push({
        id: `sig_unresolved_question_${kind}_${index}`,
        category: "unresolved_question",
        polarity: "neutral",
        phrase: "open question",
        weight: 1,
        documentKind: kind,
        source: buildSnippet({
          sentence,
          documentId: upload.id,
          kind,
        }),
      });
      perCategoryCount.set("unresolved_question", capPerCat + 1);
      unresolvedAdded++;
    }
  }

  // Stable sort: kind order → category order → original index.
  const kindIndex = (k: DocumentKind) => DOCUMENT_KINDS.indexOf(k);
  const catIndex = (c: UpdateSignalCategory) => CATEGORY_ORDER.indexOf(c);
  collected.sort((a, b) => {
    const k = kindIndex(a.documentKind) - kindIndex(b.documentKind);
    if (k !== 0) return k;
    const c = catIndex(a.category) - catIndex(b.category);
    if (c !== 0) return c;
    return 0;
  });

  const byCategory: Partial<Record<UpdateSignalCategory, UpdateSignal[]>> = {};
  for (const sig of collected) {
    const list = byCategory[sig.category] ?? [];
    list.push(sig);
    byCategory[sig.category] = list;
  }

  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;
  let netPolarityScore = 0;
  for (const sig of collected) {
    if (sig.polarity === "positive") {
      positiveCount++;
      netPolarityScore += sig.weight;
    } else if (sig.polarity === "negative") {
      negativeCount++;
      netPolarityScore -= sig.weight;
    } else {
      neutralCount++;
    }
  }

  return {
    signals: collected,
    byCategory,
    positiveCount,
    negativeCount,
    neutralCount,
    netPolarityScore,
    documentsAnalyzed,
    unsupportedDocuments,
  };
}
