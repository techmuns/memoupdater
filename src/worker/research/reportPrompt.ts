import type {
  ResearchReportSectionId,
  ResearchReportSectionRequest,
} from "@shared/types";

// Comprehensive research report — per-section prompts. This encodes the
// analyst's master "Stage 1 update note" prompt, sliced into one focused
// web-grounded call per section. The delivered <3-page memo is later condensed
// from these sections; a post-delivery Q&A answers follow-ups from them.
//
// Source discipline (verbatim intent from the master prompt): primary /
// near-primary sources only — annual reports, investor presentations, audited
// results, exchange filings, shareholding-pattern filings, earnings-call
// transcripts, credit-rating reports, regulator/company disclosures. No
// unsourced claims or brokerage commentary unless flagged as secondary. Say
// "not disclosed" rather than estimating. Never mix standalone and
// consolidated numbers.

export const RESEARCH_REPORT_SECTION_IDS: readonly ResearchReportSectionId[] = [
  "stock_valuation",
  "executive_update",
  "shareholding",
  "industry_regulatory",
  "corporate_events",
  "management_governance",
  "concall",
  "memo_vs_actual",
  "updated_view",
];

const SHARED_PREAMBLE = `You are a seasoned buy-side portfolio manager and forensic-accounting-oriented investment analyst updating an old investment memo (a "Stage 1 note") written 2–3 years ago on the company below. Treat the old memo as the original thesis and compare it against the latest available reality, with special focus on the most recent 12 months.

Use ONLY reliable primary or near-primary sources: company annual reports, investor presentations, audited results, exchange filings, shareholding-pattern filings, earnings-call transcripts, credit-rating reports, and official regulatory documents. Do not rely on unsourced claims, media speculation, or brokerage commentary unless clearly marked as secondary context. For every factual claim and number, the source must be discoverable via web_search and returned in "sources". If a datapoint is unavailable, write "not disclosed" and add it to "notDisclosed" — never estimate or hallucinate. Do not mix standalone and consolidated numbers.

Write in the style of a sharp buy-side memo update: concise, analytical, sceptical, decision-oriented. Use Markdown. Use tables where they improve clarity (valuation, shareholding, management changes, memo-vs-actual). Output ONLY this section — do not repeat the others.`;

// Per-section instruction. Faithful to the master prompt; each yields a
// self-contained Markdown section.
const SECTION_INSTRUCTIONS: Record<ResearchReportSectionId, string> = {
  stock_valuation: `SECTION: Stock Performance & Valuation Evolution Since the Stage 1 Memo.
Cover:
- Stock price on the memo date vs current price; absolute and annualized return; relative performance vs the benchmark index and key peers.
- The original target price and valuation methodology (P/E, EV/EBITDA, EV/Sales, P/B, DCF, SOTP), the historical and forward multiples used, and the earnings/EBITDA/revenue the target was built on.
- Apply the memo's ORIGINAL multiple to the latest reported and forward estimates: implied value on current-year and forward-year financials vs today's actual price.
- A "Valuation Bridge: Then vs Now" Markdown table with rows: Stock Price, Market Cap, Enterprise Value, Trailing P/E, Forward P/E, Trailing EV/EBITDA, Forward EV/EBITDA, P/B, FCF Yield (columns: Stage 1 Memo | Current).
- Explain whether returns came from earnings growth vs multiple expansion/contraction, and whether any re-rating/de-rating is justified.
- End with one line: "X% of shareholder returns came from earnings growth and Y% from multiple change since the memo."`,

  executive_update: `SECTION: Executive Update — Top 3 Changes Since the Memo (under 200 words).
Split clearly into three labelled parts:
- Industry: structure, demand, competitive intensity, pricing power, regulation, technology disruption, consolidation, customer behaviour.
- Company: strategy, business model, market share, product mix, management, ownership, acquisitions, capex, capital allocation, governance.
- Financials: revenue growth, margins, profitability, cash flows, leverage, working capital, return ratios, balance-sheet strength vs what the memo expected.
End with one clear line: "Thesis strengthened / weakened / broadly intact, because …".`,

  shareholding: `SECTION: Shareholding & Ownership Changes.
Compare the latest shareholding pattern with the structure at the time of the memo. Identify meaningful changes in promoter holding, pledge, institutional (FII/DII/MF) ownership, new large shareholders, exits by important investors, PE/VC exits, promoter dilution, preferential allotments, QIPs, warrants, rights issues, buybacks, and notable insider transactions. Use a Markdown table (Then vs Now) where it helps. Conclude whether the ownership change is positive, neutral, or concerning from a minority-shareholder perspective.`,

  industry_regulatory: `SECTION: Industry & Regulatory Developments.
Cover the most important industry-level changes since the memo: demand growth, pricing trends, input-cost environment, capacity additions, competitive intensity, customer concentration, technological disruption, substitution risk, and major regulatory changes. Explicitly flag whether regulation has become more favourable, neutral, or adverse. If there is a new structural risk (AI disruption, commoditisation, regulatory caps, platform disintermediation, customer insourcing), explain how serious it is and how management is responding.`,

  corporate_events: `SECTION: Top 3 Corporate Events in the Last 12 Months.
Identify the three most important company-specific events (acquisitions, mergers, divestments, restructuring, capex, major customer wins/losses, related-party transactions, fund-raises, debt refinancing, promoter actions, buybacks, dividends, warrants, auditor changes, litigation, regulatory action, strategic pivots). For each: (1) what happened, (2) why it matters, (3) whether it improves or weakens the investment case.`,

  management_governance: `SECTION: Management, Board & Governance / Forensic Review.
Part A — Management & Board: compare the current team and board with the memo's. Flag new CEO/CFO/COO/business heads, board appointments, independent-director or auditor resignations, KMP exits, promoter-family involvement, committee changes. Pay special attention to unexplained resignations, frequent CFO/auditor changes, related-party-heavy appointments, or weakening independent oversight.
Part B — Governance & Forensic: assess whether governance improved, deteriorated, or is stable. Review auditor remarks/qualifications/emphasis-of-matter, related-party transactions, loans/advances to group entities, contingent liabilities, pledging, promoter remuneration, board independence, ESOP dilution, capital allocation, acquisitions from related parties, guarantees, write-offs, receivable ageing, inventory build-up, customer concentration, and any regulatory/exchange actions. Clearly label red flags, yellow flags, or mitigating explanations.`,

  concall: `SECTION: Latest Earnings Call / Concall Review.
Summarize the most important commentary from the latest available transcript. Answer:
1. Management guidance on revenue growth, margins, capex, working capital, cash flow, debt, return ratios.
2. If there was an M&A: synergy potential, integration progress, cost savings, revenue synergies, timeline, risks.
3. How management addressed major concerns (AI disruption, demand slowdown, margin/pricing pressure, regulation, competition, customer concentration).
4. Where analysts pushed back or challenged assumptions.
5. Whether management answered directly with evidence, or vaguely/promotionally.
Distinguish clearly between management CLAIMS and independently verifiable facts.`,

  memo_vs_actual: `SECTION: Old Memo Financials vs Actual Reported Financials (+ 100-word variance commentary).
Using official sources (annual reports, audited statements, results filings, investor presentations, exchange filings), compare the memo's financial assumptions/forecasts against actual reported financials for the latest three years. Present a Markdown table covering wherever available: Revenue, EBITDA, EBITDA margin, EBIT, PAT, EPS, operating cash flow, free cash flow, gross debt, net debt, cash, working capital, receivable/inventory/payable days, capex, ROE, ROCE, and key segment revenue/margins. Interpret where the memo was accurate, too optimistic, or too conservative — and WHY (don't just restate numbers).
Then a ~100-word "Variance Commentary" covering: divisional/segmental performance, P&L driver (revenue/pricing/volume/mix/gross margin/employee cost/operating leverage/finance cost/depreciation/tax), balance sheet (debt/cash/receivables/inventory/payables/capital employed), and cash flow (profit-to-OCF/FCF conversion).`,

  updated_view: `SECTION: Updated Investment View.
An updated conclusion from a portfolio manager's perspective. Classify the thesis as one of: "stronger than original memo / broadly on track / mixed but monitorable / materially weakened / broken thesis." Support with 3–5 bullets. Be explicit about what would make you add, hold, reduce, or exit. List the top 3 things to monitor over the next 12 months.`,
};

// Suggested finding category per section, so the structured findings land in
// the right memo section (the memo drafter filters findings by category).
const SECTION_CATEGORY_HINT: Record<ResearchReportSectionId, string> = {
  stock_valuation: "valuation",
  executive_update: "other",
  shareholding: "filings",
  industry_regulatory: "macro (or ai_tech_risk for tech/AI risk)",
  corporate_events: "filings (or other)",
  management_governance: "management",
  concall: "guidance (or management)",
  memo_vs_actual: "financials",
  updated_view: "other",
};

export interface BuiltReportPrompt {
  system: string;
  user: string;
}

export function buildReportSectionPrompt(
  req: ResearchReportSectionRequest,
): BuiltReportPrompt {
  const instruction = SECTION_INSTRUCTIONS[req.section];
  const aliasLine =
    req.companyAliases.aliases && req.companyAliases.aliases.length > 0
      ? `\nAlso known as: ${req.companyAliases.aliases.join(", ")}.`
      : "";
  const memoBlock = req.memoContext
    ? `\n\nORIGINAL MEMO CONTEXT (for comparison — the thesis/assumptions/financials to compare today's reality against):\n${clip(req.memoContext, req.retryCompact ? 4000 : 9000)}`
    : "";
  const compactNote = req.retryCompact
    ? "\n\nKeep this tighter than usual: prioritise the highest-signal facts and the most reliable sources; fewer words, still fully sourced."
    : "";

  const user = `Company: ${req.companyAliases.longName}${aliasLine}
Ticker: ${req.project.ticker ?? "n/a"}${req.project.sector ? `\nSector: ${req.project.sector}` : ""}
Original memo period / anchor: ${req.detection.periodLabel}${req.detection.memoWrittenOn ? `\nMemo written on: ${req.detection.memoWrittenOn}` : ""}
Research window: ${req.detection.researchStart ?? "memo date"} → ${req.detection.researchCurrent}

${instruction}${memoBlock}${compactNote}

Return JSON with:
- "markdown": this section as Markdown prose/tables (the human-readable report).
- "sources": every web source used (url, title, date).
- "notDisclosed": datapoints you could not verify.
- "findings": ${req.retryCompact ? "2–4" : "3–6"} structured, INDIVIDUALLY-SOURCED findings capturing this section's most decision-relevant facts and numbers — these feed a downstream memo, so each MUST be self-contained and carry the exact figure/date in "summary" (no "see above"). Each finding: { id (short slug), category (prefer "${SECTION_CATEGORY_HINT[req.section]}"), title, summary (the fact WITH its number/date), impact ("positive"|"negative"|"neutral"|"watch"), relevance (why it matters vs the memo), sources ([{title,url,tier,date,note}]; tier ∈ official|company|exchange|transcript|press|market_data|other), thesisCheckpointId (null), linkedFlagId (null), linkedResearchTaskId (null) }. Only include findings you can source; do not invent numbers.
- "unresolvedQuestions": anything material you could not resolve.`;

  return { system: SHARED_PREAMBLE, user };
}

function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max)}\n…[truncated]`;
}
