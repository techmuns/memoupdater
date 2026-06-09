import type {
  FollowUpMemo,
  MemoDNA,
  MemoSection,
  ResearchFinding,
  ResearchFindings,
  SourceReference,
} from "@shared/types";

// Phase 5C: deterministic, no-LLM fallback memo. Built from MemoDNA +
// ResearchFindings when the OpenAI memo call fails (timeout / parse /
// rate-limit / provider error). HARD invariants the synthetic tests
// re-assert:
//   - exactly 9 canonical sections in canonical order
//   - confidence: low on every section (no fake precision)
//   - sourceMode: "deterministic"
//   - manualChecksRemaining is a single-line entry pointing at the
//     fallback path; never repeated as per-section "Needs manual
//     verification" (that string is banned in any section text)
//   - sec_final_action body uses the Phase 5B provisional template
//     verbatim, including the closing investment-advice caveat
//   - bridge is omitted (no source-anchored numbers can be safely
//     synthesized from finding metadata alone)
//   - section.sources preserve research-finding URLs via a synthetic
//     documentId of `research:<findingId>:<sourceIndex>` with quote
//     "Finding: <title>. Source: <title or url>" — no `page` invented

type FallbackSectionId =
  | "sec_thesis_snapshot"
  | "sec_q4_retest"
  | "sec_mgmt_retest"
  | "sec_ai_macro_risk"
  | "sec_memo_held"
  | "sec_memo_broke"
  | "sec_eps_bridge"
  | "sec_valuation_peer_gap"
  | "sec_final_action";

const FALLBACK_MANUAL_CHECK =
  "Compact fallback generated locally from research findings; OpenAI memo generation timed out. Human analyst sign-off required.";

const FINAL_ACTION_CAVEAT =
  "Note: This is a draft for research workflow support, not investment advice; human analyst sign-off required.";

export interface BuildFallbackMemoInput {
  project: { id: string; ticker?: string; companyName: string };
  dna: MemoDNA;
  research: ResearchFindings;
  generatedAt: string;
}

export function buildFallbackMemo(input: BuildFallbackMemoInput): FollowUpMemo {
  const { project, dna, research, generatedAt } = input;
  const byId = new Map(research.findings.map((f) => [f.id, f]));

  const sec_thesis_snapshot = makeSection(
    "sec_thesis_snapshot",
    "Original Thesis Snapshot",
    dna.originalThesis || "Original thesis was not available in the DNA.",
    [],
    [],
  );

  const financialsAndGuidance = research.findings.filter(
    (f) => f.category === "financials" || f.category === "guidance",
  );
  const sec_q4_retest = makeSection(
    "sec_q4_retest",
    "Latest Financial Re-test",
    financialsAndGuidance.length > 0
      ? "Latest financial and guidance findings from research, in the order returned by the model."
      : "No financial or guidance findings surfaced in research.",
    financialsAndGuidance.map(findingBullet),
    financialsAndGuidance,
  );

  const mgmtAndFilings = research.findings.filter(
    (f) => f.category === "management" || f.category === "filings",
  );
  const sec_mgmt_retest = makeSection(
    "sec_mgmt_retest",
    "Management Commentary Re-test",
    mgmtAndFilings.length > 0
      ? "Management commentary and filings findings from research."
      : "No management commentary or filings findings surfaced in research.",
    mgmtAndFilings.map(findingBullet),
    mgmtAndFilings,
  );

  const macroAndAi = research.findings.filter(
    (f) => f.category === "macro" || f.category === "ai_tech_risk",
  );
  const sec_ai_macro_risk = makeSection(
    "sec_ai_macro_risk",
    "AI / Macro / Competitive Risk Check",
    macroAndAi.length > 0
      ? "AI / macro / competitive risk findings from research."
      : "No AI / macro / competitive findings surfaced in research.",
    macroAndAi.map(findingBullet),
    macroAndAi,
  );

  const heldFindings = research.positiveDevelopments
    .map((id) => byId.get(id))
    .filter((f): f is ResearchFinding => Boolean(f));
  const sec_memo_held = makeSection(
    "sec_memo_held",
    "Where the Original Memo Held",
    heldFindings.length > 0
      ? "Positive developments from the research pass that the original memo correctly anticipated."
      : "No positive developments surfaced in research.",
    heldFindings.map(findingBullet),
    heldFindings,
  );

  const brokeFindings = research.negativeDevelopments
    .map((id) => byId.get(id))
    .filter((f): f is ResearchFinding => Boolean(f));
  const sec_memo_broke = makeSection(
    "sec_memo_broke",
    "Where the Original Memo Broke",
    brokeFindings.length > 0
      ? "Negative developments from the research pass that challenge the original thesis."
      : "No negative developments surfaced in research.",
    brokeFindings.map(findingBullet),
    brokeFindings,
  );

  const sec_eps_bridge = makeSection(
    "sec_eps_bridge",
    "EPS Credibility Bridge",
    "No quantitative bridge synthesized in fallback mode. See research findings for source-level numbers.",
    [],
    [],
  );

  const valuationFindings = research.findings.filter(
    (f) => f.category === "valuation",
  );
  const sec_valuation_peer_gap = makeSection(
    "sec_valuation_peer_gap",
    "Valuation and Peer Gap",
    valuationFindings.length > 0
      ? "Valuation findings from research."
      : "No valuation findings surfaced in research.",
    valuationFindings.map(findingBullet),
    valuationFindings,
  );

  const whyBullets = [
    ...brokeFindings.slice(0, 2).map((f) => `Concern: ${f.title}`),
    ...research.neutralOrWatch
      .map((id) => byId.get(id))
      .filter((f): f is ResearchFinding => Boolean(f))
      .slice(0, 1)
      .map((f) => `Watch: ${f.title}`),
  ];
  const triggers = research.unresolvedQuestions.slice(0, 3);
  const finalActionBody = [
    "Provisional action: WATCH",
    "Confidence: Low",
    "Why:",
    ...(whyBullets.length > 0
      ? whyBullets.map((b) => `- ${b}`)
      : ["- Compact fallback path — primary model output unavailable."]),
    "What would change the call:",
    ...(triggers.length > 0
      ? triggers.map((t) => `- ${t}`)
      : ["- Successful re-run of full memo generation with research findings."]),
    "",
    FINAL_ACTION_CAVEAT,
  ].join("\n");
  const sec_final_action = makeSection(
    "sec_final_action",
    "Final Investment Action",
    finalActionBody,
    [],
    [],
  );

  const sections: MemoSection[] = [
    sec_thesis_snapshot,
    sec_q4_retest,
    sec_mgmt_retest,
    sec_ai_macro_risk,
    sec_memo_held,
    sec_memo_broke,
    sec_eps_bridge,
    sec_valuation_peer_gap,
    sec_final_action,
  ];

  return {
    projectId: project.id,
    title: `Fallback Follow-up Memo — ${project.companyName}`,
    generatedAt,
    sections,
    isDemo: false,
    manualChecksRemaining: [FALLBACK_MANUAL_CHECK],
    sourceMode: "deterministic",
  };
}

function findingBullet(f: ResearchFinding): string {
  const tag =
    f.impact === "positive"
      ? "Positive"
      : f.impact === "negative"
        ? "Negative"
        : f.impact === "watch"
          ? "Watch"
          : "Neutral";
  return `${tag} · ${f.title} — ${f.summary}`;
}

function makeSection(
  id: FallbackSectionId,
  title: string,
  body: string,
  bullets: string[],
  contributingFindings: ResearchFinding[],
): MemoSection {
  const sources: SourceReference[] = [];
  for (const f of contributingFindings) {
    for (let i = 0; i < f.sources.length; i++) {
      const s = f.sources[i];
      const documentId = `research:${f.id}:${i}`;
      const sourceLabel = (s.title && s.title.trim()) || s.url || "research source";
      sources.push({
        documentId,
        quote: `Finding: ${f.title}. Source: ${sourceLabel}`,
      });
    }
  }
  return {
    id,
    title,
    body,
    bullets,
    summary: body,
    signal: "neutral",
    confidence: "low",
    sources,
  };
}
