import type {
  DocumentKind,
  FollowUpMemo,
  FollowUpMemoGenerationInput,
  FollowUpMemoGenerationResult,
  MemoSection,
  MemoSectionSignal,
  SourceReference,
  ThesisCheckpoint,
  UpdatePackAnalysis,
  UpdateSignal,
  UpdateSignalCategory,
} from "@shared/types";

const CONFIDENCE_NOTE =
  "Deterministic draft — LLM refinement to be added later.";

const POLARITY_BALANCE_TOLERANCE = 1;

interface SectionTemplate {
  id: string;
  title: string;
}

// Identical ids/titles to the demo memo so SourcePanel / SectionNavigator behave the same.
const SECTION_TEMPLATE: readonly SectionTemplate[] = [
  { id: "sec_thesis_snapshot", title: "Original Thesis Snapshot" },
  { id: "sec_q4_retest", title: "Q4 / Latest Financial Re-test" },
  { id: "sec_mgmt_retest", title: "Management Commentary Re-test" },
  { id: "sec_ai_macro_risk", title: "AI / Macro / Competitive Risk Check" },
  { id: "sec_memo_held", title: "Where the Original Memo Held" },
  { id: "sec_memo_broke", title: "Where the Original Memo Broke" },
  { id: "sec_eps_bridge", title: "FY27–FY28 EPS Credibility Bridge" },
  { id: "sec_valuation_peer_gap", title: "Valuation and Peer Gap" },
  { id: "sec_final_action", title: "Final Investment Action" },
];

// ---------- Composition helpers ----------

function firstSentence(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  const m = trimmed.match(/^(.+?[.!?])(\s|$)/);
  return m ? m[1] : trimmed.slice(0, 240);
}

function uniqueByDocId(refs: SourceReference[], cap: number): SourceReference[] {
  const seen = new Set<string>();
  const out: SourceReference[] = [];
  for (const r of refs) {
    if (seen.has(r.documentId)) continue;
    seen.add(r.documentId);
    out.push(r);
    if (out.length >= cap) break;
  }
  return out;
}

function sourcesFromSignals(
  signals: UpdateSignal[],
  cap = 3,
): SourceReference[] {
  return uniqueByDocId(
    signals.map((sig) => ({
      documentId: sig.source.documentId,
      quote: sig.source.quote,
      ...(sig.source.page !== undefined ? { page: sig.source.page } : {}),
    })),
    cap,
  );
}

function pickSignals(
  analysis: UpdatePackAnalysis,
  categories: UpdateSignalCategory[],
  options: {
    polarity?: "positive" | "negative" | "any";
    kindPriority?: DocumentKind[];
    limit?: number;
  } = {},
): UpdateSignal[] {
  const { polarity = "any", kindPriority = [], limit = 5 } = options;
  const catSet = new Set(categories);
  const matched = analysis.signals.filter(
    (sig) =>
      catSet.has(sig.category) &&
      (polarity === "any" || sig.polarity === polarity),
  );
  if (kindPriority.length > 0) {
    matched.sort((a, b) => {
      const aIdx = kindPriority.indexOf(a.documentKind);
      const bIdx = kindPriority.indexOf(b.documentKind);
      const aRank = aIdx === -1 ? kindPriority.length : aIdx;
      const bRank = bIdx === -1 ? kindPriority.length : bIdx;
      if (aRank !== bRank) return aRank - bRank;
      return b.weight - a.weight;
    });
  }
  return matched.slice(0, limit);
}

function aggregateSignal(signals: UpdateSignal[]): MemoSectionSignal {
  if (signals.length === 0) return "neutral";
  let pos = 0;
  let neg = 0;
  for (const sig of signals) {
    if (sig.polarity === "positive") pos += sig.weight;
    else if (sig.polarity === "negative") neg += sig.weight;
  }
  if (pos === 0 && neg === 0) return "neutral";
  if (Math.abs(pos - neg) <= POLARITY_BALANCE_TOLERANCE && pos > 0 && neg > 0) {
    return "watch";
  }
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

function quotesAsBullets(signals: UpdateSignal[], cap = 5): string[] {
  return signals.slice(0, cap).map((sig) => sig.source.quote);
}

function directionLabel(d: "up" | "down" | "flat"): string {
  return d === "up" ? "up" : d === "down" ? "down" : "flat";
}

// ---------- Checkpoint ↔ category bridge ----------

function categoriesForCheckpoint(
  cp: ThesisCheckpoint,
): UpdateSignalCategory[] {
  const hay = `${cp.label} ${cp.rationale}`.toLowerCase();
  const cats = new Set<UpdateSignalCategory>();
  if (/(arr|nrr|net revenue retention|retention|churn|cross-sell)/.test(hay))
    cats.add("recurring_quality");
  if (/(rule of 40|margin|ebitda|profit|operating leverage)/.test(hay)) {
    cats.add("margin");
    cats.add("financial_growth");
  }
  if (/(buyback|capital return|repurchase|dividend|allocation)/.test(hay))
    cats.add("management");
  if (/(integration|acquisition|m&a|synerg)/.test(hay))
    cats.add("ma_integration");
  if (/(multiple|valuation|target|peer|fair value)/.test(hay))
    cats.add("valuation");
  if (/(ai|disrupt|competitive|macro|fx|regulatory|share)/.test(hay))
    cats.add("ai_macro_competitive");
  if (/(guidance|outlook|guide)/.test(hay)) cats.add("guidance");
  if (cats.size === 0) cats.add("financial_growth");
  return Array.from(cats);
}

function checkpointStatus(
  cp: ThesisCheckpoint,
  analysis: UpdatePackAnalysis,
): {
  held: UpdateSignal[];
  broke: UpdateSignal[];
  status: "held" | "broke" | "watch" | "no_evidence";
} {
  const cats = categoriesForCheckpoint(cp);
  const expected = cp.expectedDirection;
  const positiveAgrees = expected === "up";
  const negativeAgrees = expected === "down";
  const neutralAgrees = expected === "flat";

  const held: UpdateSignal[] = [];
  const broke: UpdateSignal[] = [];
  for (const sig of analysis.signals) {
    if (!cats.includes(sig.category)) continue;
    const agrees =
      (sig.polarity === "positive" && positiveAgrees) ||
      (sig.polarity === "negative" && negativeAgrees) ||
      (sig.polarity === "neutral" && neutralAgrees);
    if (agrees) held.push(sig);
    else if (sig.polarity !== "neutral") broke.push(sig);
  }

  let status: "held" | "broke" | "watch" | "no_evidence";
  if (held.length === 0 && broke.length === 0) status = "no_evidence";
  else if (broke.length === 0) status = "held";
  else if (held.length === 0) status = "broke";
  else status = "watch";

  return { held, broke, status };
}

// ---------- Section builders ----------

function buildThesisSnapshot(
  input: FollowUpMemoGenerationInput,
): MemoSection {
  const { dna, uploads } = input;
  const thesisFirst = firstSentence(dna.originalThesis);
  const method = dna.valuationFramework.method || "valuation method";
  const target = dna.valuationFramework.targetMultiple || "target multiple";
  const top = dna.thesisCheckpoints.slice(0, 4);

  const summary = `Original thesis: ${thesisFirst} Valuation anchored on ${method} at ${target}. Re-test scope below.`;
  const bullets = top.map(
    (cp) => `${cp.label} — expected ${directionLabel(cp.expectedDirection)}`,
  );

  const body = [
    summary,
    dna.valuationFramework.bridgeNotes.length > 0
      ? `Bridge anchors: ${dna.valuationFramework.bridgeNotes.slice(0, 3).join("; ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const initialId = uploads.initial_memo?.id;
  const sources: SourceReference[] = initialId
    ? [{ documentId: initialId }]
    : [];

  return {
    id: "sec_thesis_snapshot",
    title: "Original Thesis Snapshot",
    body,
    sources,
    summary,
    bullets,
    signal: "neutral",
    confidenceNote: CONFIDENCE_NOTE,
  };
}

function buildFinancialRetest(
  analysis: UpdatePackAnalysis,
): MemoSection {
  const relevant = pickSignals(
    analysis,
    ["financial_growth", "margin", "recurring_quality"],
    { kindPriority: ["financials", "management_commentary"], limit: 5 },
  );
  const pos = relevant.filter((s) => s.polarity === "positive").length;
  const neg = relevant.filter((s) => s.polarity === "negative").length;
  const signal = aggregateSignal(relevant);

  const summary =
    relevant.length > 0
      ? `Latest financials show ${pos} confirming and ${neg} challenging data points vs the model.`
      : "No financial-pack signals extracted in this run — upload Q4 results or call transcript to populate.";

  const bullets = quotesAsBullets(relevant, 5);

  return {
    id: "sec_q4_retest",
    title: "Q4 / Latest Financial Re-test",
    body: summary,
    sources: sourcesFromSignals(relevant),
    summary,
    bullets,
    signal,
    confidenceNote: CONFIDENCE_NOTE,
  };
}

function buildManagementRetest(
  input: FollowUpMemoGenerationInput,
): MemoSection {
  const { dna, analysis } = input;
  const relevant = pickSignals(
    analysis,
    ["management", "guidance", "ma_integration"],
    { kindPriority: ["management_commentary"], limit: 5 },
  );
  const openQ = dna.openQuestions.length;
  const addressed = Math.min(openQ, relevant.length);
  const tone =
    relevant.length === 0
      ? "no commentary in scope"
      : aggregateSignal(relevant) === "positive"
        ? "positive"
        : aggregateSignal(relevant) === "negative"
          ? "cautious"
          : "mixed";

  const summary =
    relevant.length > 0
      ? `Management addressed ${addressed} of our ${openQ || "open"} open questions; tone reads ${tone}.`
      : "No management-commentary signals extracted — upload a transcript or written commentary to populate.";

  const bullets = quotesAsBullets(relevant, 5);

  return {
    id: "sec_mgmt_retest",
    title: "Management Commentary Re-test",
    body: summary,
    sources: sourcesFromSignals(relevant),
    summary,
    bullets,
    signal: aggregateSignal(relevant),
    confidenceNote: CONFIDENCE_NOTE,
  };
}

function buildRiskCheck(
  analysis: UpdatePackAnalysis,
): MemoSection {
  const relevant = pickSignals(analysis, ["ai_macro_competitive"], {
    kindPriority: ["macro_notes", "competitor_notes"],
    limit: 5,
  });
  const pos = relevant.filter((s) => s.polarity === "positive").length;
  const neg = relevant.filter((s) => s.polarity === "negative").length;
  const summary =
    relevant.length > 0
      ? `AI/macro/competitive check: ${neg} pressure signals, ${pos} mitigants across macro and competitor notes.`
      : "No macro/competitive signals extracted — upload macro or competitor notes to populate.";
  const bullets = quotesAsBullets(relevant, 5);

  return {
    id: "sec_ai_macro_risk",
    title: "AI / Macro / Competitive Risk Check",
    body: summary,
    sources: sourcesFromSignals(relevant),
    summary,
    bullets,
    signal: aggregateSignal(relevant),
    confidenceNote: CONFIDENCE_NOTE,
  };
}

function buildMemoHeld(
  input: FollowUpMemoGenerationInput,
): MemoSection {
  const { dna, analysis } = input;
  const heldBullets: string[] = [];
  const allSources: SourceReference[] = [];
  let heldCount = 0;
  for (const cp of dna.thesisCheckpoints) {
    const status = checkpointStatus(cp, analysis);
    if (status.status === "held" && status.held.length > 0) {
      heldCount++;
      const top = status.held[0];
      heldBullets.push(`${cp.label} — ${top.source.quote}`);
      allSources.push({
        documentId: top.source.documentId,
        quote: top.source.quote,
        ...(top.source.page !== undefined ? { page: top.source.page } : {}),
      });
    }
  }
  const total = dna.thesisCheckpoints.length;
  const summary = `${heldCount} of ${total} thesis checkpoints are tracking as expected.`;
  return {
    id: "sec_memo_held",
    title: "Where the Original Memo Held",
    body: summary,
    sources: uniqueByDocId(allSources, 3),
    summary,
    bullets: heldBullets,
    signal: heldCount > 0 ? "positive" : "neutral",
    confidenceNote: CONFIDENCE_NOTE,
  };
}

function buildMemoBroke(
  input: FollowUpMemoGenerationInput,
): MemoSection {
  const { dna, analysis } = input;
  const brokeBullets: string[] = [];
  const allSources: SourceReference[] = [];
  let brokeCount = 0;
  let watchSeen = false;
  for (const cp of dna.thesisCheckpoints) {
    const status = checkpointStatus(cp, analysis);
    if (status.status === "broke" && status.broke.length > 0) {
      brokeCount++;
      const top = status.broke[0];
      brokeBullets.push(`${cp.label} — ${top.source.quote}`);
      allSources.push({
        documentId: top.source.documentId,
        quote: top.source.quote,
        ...(top.source.page !== undefined ? { page: top.source.page } : {}),
      });
    } else if (status.status === "watch") {
      watchSeen = true;
      const top = status.broke[0];
      if (top) {
        brokeBullets.push(`${cp.label} (mixed) — ${top.source.quote}`);
        allSources.push({
          documentId: top.source.documentId,
          quote: top.source.quote,
          ...(top.source.page !== undefined ? { page: top.source.page } : {}),
        });
      }
    }
  }
  const total = dna.thesisCheckpoints.length;
  const summary = `${brokeCount} of ${total} checkpoints show evidence against the original call.`;
  const signal: MemoSectionSignal =
    brokeCount > 0 ? "negative" : watchSeen ? "watch" : "positive";
  return {
    id: "sec_memo_broke",
    title: "Where the Original Memo Broke",
    body: summary,
    sources: uniqueByDocId(allSources, 3),
    summary,
    bullets: brokeBullets,
    signal,
    confidenceNote: CONFIDENCE_NOTE,
  };
}

function buildEpsBridge(
  input: FollowUpMemoGenerationInput,
): MemoSection {
  const { dna, analysis } = input;
  const epsSignals = pickSignals(
    analysis,
    ["financial_growth", "margin", "guidance"],
    { kindPriority: ["financials", "management_commentary"], limit: 4 },
  );
  const net = analysis.netPolarityScore;
  const direction =
    net > 2 ? "improving" : net < -2 ? "softening" : "mixed";

  const summary = `EPS credibility: net evidence is ${direction} (net polarity ${net}).`;
  const bridgeNotes = dna.valuationFramework.bridgeNotes.slice(0, 3);
  const supportingQuotes = quotesAsBullets(epsSignals.slice(0, 2), 2);
  const bullets = [...bridgeNotes, ...supportingQuotes];

  return {
    id: "sec_eps_bridge",
    title: "FY27–FY28 EPS Credibility Bridge",
    body: summary,
    sources: sourcesFromSignals(epsSignals, 2),
    summary,
    bullets,
    signal: aggregateSignal(epsSignals),
    confidenceNote: CONFIDENCE_NOTE,
  };
}

function buildValuationPeerGap(
  input: FollowUpMemoGenerationInput,
): MemoSection {
  const { dna, analysis } = input;
  const valSignals = pickSignals(analysis, ["valuation"], {
    kindPriority: ["broker_notes", "market_data"],
    limit: 5,
  });
  const pos = valSignals.filter((s) => s.polarity === "positive").length;
  const neg = valSignals.filter((s) => s.polarity === "negative").length;
  const method = dna.valuationFramework.method || "the existing method";
  const target = dna.valuationFramework.targetMultiple || "current multiple";

  const summary = `Valuation re-test on ${method} at ${target}: ${pos} upside vs ${neg} downside signals from broker/market data.`;
  const bullets = quotesAsBullets(valSignals, 5);
  if (analysis.unsupportedDocuments.includes("market_data")) {
    bullets.push(
      "Market-data comps file not parsed (xlsx) — peer multiples not auto-extracted.",
    );
  }

  return {
    id: "sec_valuation_peer_gap",
    title: "Valuation and Peer Gap",
    body: summary,
    sources: sourcesFromSignals(valSignals),
    summary,
    bullets,
    signal: aggregateSignal(valSignals),
    confidenceNote: CONFIDENCE_NOTE,
  };
}

function topWeightedSignals(
  analysis: UpdatePackAnalysis,
  limit: number,
): UpdateSignal[] {
  return [...analysis.signals]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}

function buildFinalAction(
  input: FollowUpMemoGenerationInput,
  overallSignal: MemoSectionSignal,
): MemoSection {
  const { analysis } = input;
  const net = analysis.netPolarityScore;
  const action =
    net > 2 ? "Lean Add" : net < -2 ? "Lean Trim" : "Hold";

  const summary = `Synthesis: ${action} (net polarity ${net}; ${analysis.positiveCount} positive / ${analysis.negativeCount} negative signals across ${analysis.documentsAnalyzed.length} document${analysis.documentsAnalyzed.length === 1 ? "" : "s"}). This is a deterministic draft, not investment advice; LLM refinement and human sign-off required.`;

  const triggers: string[] = [];
  if (overallSignal === "negative" || action === "Lean Trim") {
    triggers.push(
      "Trim trigger: another print confirming the negative signals above.",
    );
  }
  if (overallSignal === "positive" || action === "Lean Add") {
    triggers.push(
      "Add trigger: positive signals confirmed across two consecutive prints.",
    );
  }
  if (overallSignal === "watch") {
    triggers.push(
      "Watch trigger: mixed evidence — wait for next print before re-sizing.",
    );
  }

  const topSignals = topWeightedSignals(analysis, 3);

  return {
    id: "sec_final_action",
    title: "Final Investment Action",
    body: summary,
    sources: sourcesFromSignals(topSignals, 3),
    summary,
    bullets: triggers,
    signal: overallSignal,
    confidenceNote: CONFIDENCE_NOTE,
  };
}

// ---------- Top-level generator ----------

export function generateFollowUpMemo(
  input: FollowUpMemoGenerationInput,
): FollowUpMemoGenerationResult {
  const { dna, analysis, generatedAt } = input;
  const warnings: string[] = [];
  if (analysis.documentsAnalyzed.length === 0) {
    warnings.push("No update-pack documents were successfully extracted.");
  }
  if (analysis.unsupportedDocuments.length > 0) {
    warnings.push(
      `${analysis.unsupportedDocuments.length} uploaded document${analysis.unsupportedDocuments.length === 1 ? " was" : "s were"} not parseable (xlsx/docx unsupported in this phase).`,
    );
  }

  const sections: MemoSection[] = [
    buildThesisSnapshot(input),
    buildFinancialRetest(analysis),
    buildManagementRetest(input),
    buildRiskCheck(analysis),
    buildMemoHeld(input),
    buildMemoBroke(input),
    buildEpsBridge(input),
    buildValuationPeerGap(input),
  ];

  // Overall signal from net polarity score across all signals.
  const overallSignal: MemoSectionSignal = (() => {
    const net = analysis.netPolarityScore;
    if (analysis.signals.length === 0) return "neutral";
    if (
      analysis.positiveCount > 0 &&
      analysis.negativeCount > 0 &&
      Math.abs(net) <= POLARITY_BALANCE_TOLERANCE
    ) {
      return "watch";
    }
    if (net > 0) return "positive";
    if (net < 0) return "negative";
    return "neutral";
  })();

  sections.push(buildFinalAction(input, overallSignal));

  // Sanity: order matches SECTION_TEMPLATE.
  for (let i = 0; i < SECTION_TEMPLATE.length; i++) {
    if (sections[i].id !== SECTION_TEMPLATE[i].id) {
      warnings.push(
        `Section order mismatch at position ${i}: expected ${SECTION_TEMPLATE[i].id}, got ${sections[i].id}.`,
      );
    }
  }

  const memo: FollowUpMemo = {
    projectId: dna.projectId,
    title: "Follow-up Memo v0 — Deterministic Draft",
    generatedAt,
    sections,
    isDemo: false,
  };

  return { memo, analysis, overallSignal, warnings };
}
