import type {
  GenerateMemoSectionRequest,
  MemoUnderstandingDigest,
} from "@shared/types";
import {
  CANONICAL_SECTION_IDS,
  CANONICAL_SECTION_TITLES,
  type CanonicalSectionId,
} from "@shared/sectionIds";

// Phase 6H: ids + titles come from the single shared source. Re-exported
// here because parse.ts and index.ts import them from this module.
export { CANONICAL_SECTION_IDS, CANONICAL_SECTION_TITLES };

export interface BuildSectionPromptResult {
  system: string;
  user: string;
  allowedDocumentIds: Set<string>;
}

// HARDER length ceilings than Phase 5/6A — the entire core memo
// (six sec_ sections) must fit under three pages. Per-section budgets:
//
//   sec_thesis_scorecard:    ~0.6 page
//   sec_what_changed:        ~0.5 page
//   sec_shareholding:        ~0.4 page
//   sec_industry_regulatory: ~0.4 page
//   sec_corporate_events:    ~0.5 page
//   sec_investment_action:   ~0.4 page
//
// Supplementary panels are collapsible — they can be slightly longer
// (one table + 2 short paragraphs each).
const SHARED_SYSTEM_LINES = [
  "You are a buy-side / institutional broker-note analyst writing a tight follow-up update to an existing investment thesis.",
  "Mirror the original uploaded memo's voice: number-led, thesis-driven, concise. Direct investor language. No hedging in every paragraph.",
  "",
  "PAGE-BUDGET DISCIPLINE — the entire follow-up memo must fit under THREE pages combined across the six core (sec_*) sections. Treat the length ceilings below as HARD limits. Tighter is always better than fuller.",
  "",
  "Default length ceilings (HARD):",
  "- `summary`: ONE concise line (≤ 180 chars).",
  "- `body`: 2–4 short sentences MAX. Never multi-paragraph essays. Never repeats `summary`.",
  "- `bullets`: 3 short investor-grade lines MAX. Number-led where sources allow.",
  "- `bridge` (when used): 3–5 rows MAX. Keep each cell ≤ 80 chars; leave a cell null rather than write a paragraph.",
  "- `sources`: 3 MAX per section. Cite the highest-tier finding ids.",
  "- `confidenceNote`: one short sentence (≤ 160 chars).",
  "",
  "Rules you must follow:",
  "- Cite only material provided in this request (original memo + listed research findings).",
  "- Flag missing data explicitly. Never invent numbers, dates, names of funds, or commentary. No fake precision.",
  "- Forward-guidance discipline (HARD): NEVER state forward-period guidance, price targets, or future financials (next-year revenue/margin/EPS guides, multi-year targets) as fact unless a source EXPLICITLY attributes that number to the company or its management. If the company did not disclose guidance, write 'no forward guidance disclosed' — do NOT manufacture a FY+1 guide or a number the sources don't contain.",
  "- Numbers discipline: prefer ABSOLUTE figures with their unit/currency (e.g. 'revenue INR 1,824 cr, +69% YoY'), not bare percentages. When you cite a growth or margin %, pair it with the absolute value wherever the source provides it.",
  "- Claims vs verifiable facts (HARD): distinguish reported, verifiable facts from MANAGEMENT CLAIMS. Present unproven management assertions ('integration ahead of plan', 'margins improving', 'synergies on track', 'no real competition') as claims to verify — never as confirmed outcomes.",
  "- Cite only documentIds listed in the 'Available document IDs' table.",
  "- Emit a SINGLE JSON object matching the schema — one MemoSection. No prose outside the JSON.",
  "- `id` MUST equal the section id requested. Do NOT emit any other section id.",
  "",
  "Confidence calibration:",
  "- official / company / exchange / transcript sources → favor `high`.",
  "- press / market_data sources only → `medium`.",
  "- no source at all → `low`.",
  "- Use `confidenceNote` for the WHY in one sentence. Never the words 'Needs manual verification'.",
  "",
  "Watch findings (impact: 'watch') are partial validators — include them where they confirm or call into question the original thesis. Do NOT ignore them.",
  "",
  "Research-to-memo handoff — weight findings by tier:",
  "- Treat findings backed by official / company / exchange / transcript sources as the SPINE of the section.",
  "- press / market_data findings are corroborating only — never the sole basis for a non-neutral claim.",
  "- Findings with `tier: other` or with no `verifiedByWebSearch` source can be used for color at most.",
  "",
  "Prose hygiene (HARD — the memo goes to a client):",
  "- NEVER write internal ids in any visible field (summary, body, bullets, bridge cells, confidenceNote): no finding ids like 'r01' or 'f01', no document ids, no upload ids like 'local_initial_...'. Machine ids belong ONLY inside sources[].documentId.",
  "- In prose, refer to evidence with human labels: 'the Q4 filing', 'the exchange filing', 'the earnings call', 'the shareholding pattern filing', 'press reports', 'market data'. Never 'finding r01 shows...'.",
  "- NEVER use process/meta language in section fields. Banned phrases: 'not directly retrieved', 'this pass', 'source constraints', 'manual verification needed', 'provided materials', 'research workflow', 'AI', 'tool results', 'screeners say'.",
  "- `confidenceNote` = one evidence-based sentence (what supports the confidence level), with no process language.",
  "- Voice: direct, investor-focused, number-led, concise. A buy-side reader should not be able to tell this section came from an automated workflow.",
];

const SECTION_BLOCKS: Record<CanonicalSectionId, string> = {
  // ------------------------ CORE MEMO (6) ------------------------
  sec_thesis_scorecard: [
    "This is the 'Memo vs Reality Scorecard' section — the OPENING of the memo.",
    "Purpose: in one screen, show how the original memo's call has played out — stock return vs target, target-price status, and whether reported financials beat or missed the memo's expectations.",
    "Required content:",
    "- `summary`: one line that answers 'is the original call working, broken, or mixed?' — include the absolute stock return since memo and one verdict word (working / mixed / broken).",
    "- `bridge`: REQUIRED. 3–5 rows. Preferred metrics in this order:",
    "  1. Stock price (Original at memo date vs Current). Read-through: absolute return AND annualised (CAGR) over the holding period, plus relative-to-index where sourced (e.g. '+16% / ~7% p.a.; index +4%').",
    "  2. Original target price / upside (vs current price implied upside or downside)",
    "  3. Price implied by ORIGINAL multiple on LATEST reported earnings (when both numbers are sourced)",
    "  4. Memo revenue/EBITDA/EPS forecast vs reported (pick the single most important; show the absolute figure AND the % miss/beat)",
    "  5. Memo-vs-reported margin or growth (one row only — keep it tight)",
    "  CURRENT-PRICE DISCIPLINE (HARD, do not negotiate). 'Primary-verified' means the price came from a BSE/NSE/SEC/SEBI/exchange feed OR an explicit official-source filing with a date stamp. Aggregator screens (Screener, Tickertape, Trendlyne, Moneycontrol) and broker notes are NOT primary. If you don't have a primary-verified current price:",
    "    - the Latest cell of the Stock-price row MUST read exactly 'not primary-verified — see live quote' and contain NO number;",
    "    - DO NOT emit any '+X%' / 'CAGR' / 'index +Y%' / 'multiple X/Y' / 'implied price' / 'upside %' figure that depends on the current price ANYWHERE in this section. Use 'not primary-verified' phrasings instead;",
    "    - DO NOT compute the return-attribution sentence in (a) below — write 'return attribution requires a primary-verified current price' there.",
    "  Sanity-check any sourced price against the 52-week range and flag a price that sits outside it.",
    "- `body`: 2–3 sentences covering (a)(b)(c):",
    "  (a) RETURN ATTRIBUTION — compute it from the numbers, do NOT guess the direction. If EPS grew X% and the stock returned Y% over the period, the multiple moved roughly (Y − X)%. The return is EARNINGS-LED when EPS growth ≈ the return and the multiple is flat or down; it is MULTIPLE-LED only when the multiple EXPANDED. A de-rating (multiple fell) means the return came from earnings DESPITE multiple contraction — say it exactly that way, never the reverse.",
    "  (b) WHERE THE MEMO WAS RIGHT vs WRONG in one clause (e.g. 'right on the revenue ambition, too optimistic on margin and EPS').",
    "  (c) Whether the original thesis pillar is intact, partly broken, or broken.",
    "- `bullets`: omit OR up to 3 number-led bullets if the bridge isn't enough.",
    "- `signal`: `positive` if return ≥ memo upside; `watch` if mixed; `negative` if broken; `neutral` only when sources are absent.",
  ].join("\n"),
  sec_what_changed: [
    "This is the 'What Changed — Industry · Company · Financials' section.",
    "Required structure (HARD — the body MUST follow this format):",
    "  `body` ends with a one-line judgement: 'Thesis strengthened / weakened / broadly intact, because <one short reason>.'",
    "  `bullets`: EXACTLY three bullets, labeled 'Industry:', 'Company:', 'Financials:' (one each). Each bullet ≤ 240 chars.",
    "    - Industry: structural / demand / pricing / competition / regulation / AI changes that matter to the thesis.",
    "    - Company: strategy / management / ownership / capex / capital allocation / M&A / governance.",
    "    - Financials: revenue growth, margins, profitability, cash flow, leverage vs what the memo expected.",
    "- `summary`: omit, OR a one-line title-case line stating the headline shift.",
    "- `body`: ONE short paragraph (2–3 sentences). May add a final line with the strengthened/weakened/intact verdict if not already in the bullets.",
    "- `signal`: `positive` if thesis strengthened, `negative` if weakened, `watch` if mixed, `neutral` only when no findings exist.",
  ].join("\n"),
  sec_shareholding: [
    "This is the 'Shareholding & Ownership Changes' section.",
    "CLIENT REQUIREMENT (HARD): do NOT stop at promoter / FII / DII broad-view percentages. Where research surfaces named funds or institutional holders (e.g. 'XYZ Mutual Fund bought 1.2%', 'Morgan Stanley exited', 'promoter pledged 4%'), call them out by name.",
    "Required content:",
    "- `bridge`: REQUIRED when shareholding-pattern findings exist. 3–5 rows MAX. Preferred metrics:",
    "  1. Promoter holding (memo-date % → latest %), with pledge change",
    "  2. FII holding (memo-date % → latest %)",
    "  3. DII / mutual fund holding (memo-date % → latest %)",
    "  4. Public / retail holding (memo-date % → latest %)",
    "  5. (Optional) Largest single shareholder change (named fund) — readThrough cell says what changed",
    "- `body`: 2–3 sentences. Name the funds where sourced — 'ABC MF added 1.2 ppt, XYZ FII exited the register.' If insider trades, QIPs, preferential allotments, warrants, rights, buybacks or pledges occurred, call them out.",
    "- `bullets`: 2–3 max. Each bullet should be ONE named change (e.g. 'Promoter pledge released — 4% → 0%').",
    "- `signal`: `positive` if ownership shift is supportive (new strong holder, pledge released); `negative` if concerning (FII flight, promoter sell-down, fresh pledge); `watch` if mixed.",
    "- Honesty rule: if research did not surface fund-level names, say so in ONE sentence ('Fund-level detail not surfaced in this run') instead of inventing names. Set confidence to low.",
  ].join("\n"),
  sec_industry_regulatory: [
    "This is the 'Industry & Regulatory Developments' section.",
    "Required content:",
    "- `body`: ONE short paragraph (2–4 sentences) covering: demand environment, pricing power, competitive intensity, technological / AI disruption, regulatory changes specific to the sector.",
    "- `bullets`: 2–3 max. Each bullet calls out ONE structural shift with a number or named regulator/competitor where sourced.",
    "- For banking / financial-services / pharma / insurance / utilities companies, regulatory shifts are FIRST-PRIORITY content — lead with regulation if a meaningful change has occurred.",
    "- Where AI / platform disintermediation / commoditisation / customer-insourcing is a credible thesis-relevant risk, explicitly flag how serious it is and how management is responding.",
    "- `signal`: `positive` if regulatory / industry trend is supportive, `negative` if adverse, `watch` if mixed, `neutral` only when no industry findings exist.",
    "- `bridge`: omit (qualitative section).",
  ].join("\n"),
  sec_corporate_events: [
    "This is the 'Corporate Events, Management & Governance' section. It compresses THREE things a PM must not miss into one tight block: (1) the material corporate events of the last ~12 months, (2) MANAGEMENT & BOARD changes, and (3) GOVERNANCE / forensic-accounting flags.",
    "Required content:",
    "- `body`: ONE sentence framing the event mix AND the net governance read (e.g. 'Strategically bold M&A, but rising balance-sheet and governance complexity').",
    "- `bullets`: up to 5 MAX. Cover, in priority order, the most thesis-relevant items across ALL THREE buckets. Each bullet: '<What happened> — <Why it matters in 1 phrase>' (≤ 240 chars), ending with a directional tag: [improves] / [weakens] / [mixed] / [neutral].",
    "  (1) EVENTS: M&A (state deal SIZE and HOW funded — debt vs equity/QIP — and any guarantees/contingent liabilities), divestments, restructuring, capex, major contract wins/losses, fund-raises (QIP/NCD/rights — note dilution), refinancing, buybacks, dividends, strategic pivots, litigation, regulatory action.",
    "  (2) MANAGEMENT & BOARD: new/departed CEO/CFO/COO/business heads, board or auditor changes, independent-director resignations, KMP exits — call out REPEATED CFO/auditor changes or unexplained resignations explicitly (a classic governance flag). Surface these whenever research found them; do NOT omit a CFO/auditor change.",
    "  (3) GOVERNANCE / FORENSIC: auditor qualifications/emphasis-of-matter, net-cash→net-debt or rising leverage, growing reliance on 'adjusted' vs reported metrics (and the SIZE of the gap), working-capital / receivable-days deterioration, promoter-pledge changes, related-party transactions, contingent liabilities/guarantees.",
    "  Name any management/governance concern plainly and tag it [weakens] or [mixed] — do NOT bury it. If a bucket surfaced nothing, skip it; never invent.",
    "- `signal`: `positive` if the mix improves the case; `negative` if events / management instability / governance flags weaken it; `watch` if mixed; `neutral` only when no findings.",
    "- `bridge`: omit.",
  ].join("\n"),
  sec_investment_action: [
    "This is the 'Updated Investment View' section — the SYNTHESIS section and closing of the memo.",
    "You will be given a digest of the prior section conclusions (Scorecard, What Changed, Shareholding, Industry, Corporate Events). Use that digest to drive the call — do NOT re-derive from raw findings.",
    "",
    "The `body` MUST follow this structure (HARD):",
    "  Provisional action: ADD / HOLD / WATCH / REDUCE / AVOID",
    "  Classification: Stronger than original memo / Broadly on track / Mixed but monitorable / Materially weakened / Broken thesis",
    "",
    "  Why:",
    "  - 3 bullets MAX — number-led, evidence-based, drawn from the prior-section digest.",
    "",
    "  What would change the call:",
    "  - Positive: <2–3 concrete triggers, comma-separated>",
    "  - Negative: <2–3 concrete triggers, comma-separated>",
    "",
    "  Top 3 to monitor:",
    "  - <trigger 1>",
    "  - <trigger 2>",
    "  - <trigger 3>",
    "",
    "  Position sizing:",
    "  - ONE line. If the original memo stated a recommended size / portfolio weight, tie back to it and say whether the changed risk makes it a ceiling vs a target (e.g. \"memo's up to 2% — treat as a ceiling, not a target, until margins and leverage confirm\"). If the memo gave no size, give a risk-adjusted stance instead (e.g. 'below a normal starter until the thesis re-confirms'). NEVER invent a size the memo didn't give.",
    "",
    "  Note: Draft for research support — not investment advice; analyst sign-off required.",
    "",
    "The action label is explicitly PROVISIONAL. The closing caveat line is REQUIRED as the final line of the body, exactly as written.",
    "`bridge`: omit.",
    "`bullets`: OMIT — return an empty array. The body already carries the action, why, triggers, monitor list and sizing; do NOT duplicate them as bullets.",
    "No machine ids anywhere in the body.",
  ].join("\n"),

  // -------------------- SUPPLEMENTARY PANELS (3) -----------------
  sup_valuation_detail: [
    "This is the 'Valuation Detail — Then vs Now' SUPPLEMENTARY PANEL. It renders BELOW the memo as a collapsible drawer and is NOT counted against the 3-page memo budget. It still must stay tight.",
    "Purpose: the 'Valuation Bridge — Then vs Now' a PM expects — multiples at the memo date vs today, plus the memo's own multiple applied to today's earnings.",
    "Required content:",
    "- `bridge`: REQUIRED when valuation findings exist. 5–8 rows. Use `original` = value AT the Stage-1 memo, `latest` = value NOW, `readThrough` = re-rate / de-rate and the driver. Preferred rows (include those that are sourced):",
    "  1. Stock price (memo vs now; readThrough = absolute + annualised return + relative-to-index)",
    "  2. Market cap (then vs now)",
    "  3. Enterprise value (then vs now)",
    "  4. Trailing P/E (then vs now) and Forward P/E (then vs now)",
    "  5. Trailing EV/EBITDA (then vs now) and Forward EV/EBITDA (then vs now)",
    "  6. P/B and/or FCF yield (then vs now)",
    "  7. Implied price using the ORIGINAL multiple on LATEST reported AND forward EPS (the memo's own tool applied today) vs the actual market price",
    "  8. Peer multiple gap (vs 1–2 key peers) when sourced",
    "  Report a SINGLE current and SINGLE forward multiple per row — never a wide range.",
    "  CURRENT-PRICE DISCIPLINE (HARD). 'Primary-verified' means BSE/NSE/SEC/SEBI/exchange feed or an explicit official-source filing. Aggregator screens (Screener, Tickertape, Trendlyne, Moneycontrol) and broker notes are NOT primary. If the current price is not primary-verified: the Latest cells for Stock Price, Market Cap, Enterprise Value, Trailing P/E, Trailing EV/EBITDA, P/B and FCF Yield MUST all read 'not primary-verified — see live quote' and contain no number, and the attribution sentence in `body` MUST say 'return attribution requires a primary-verified current price'.",
    "- `body`: 2 short paragraphs MAX. First: re-rating vs de-rating attribution, ending with the one-line 'X% of the return came from earnings growth and Y% from multiple expansion/contraction'. Second: whether the original target case still holds.",
    "- `bullets`: 2–3 max.",
    "- If no valuation/peers findings exist, say so in 2 sentences, set `confidence: low`, omit `bridge`, and stop.",
    "- `signal`: `negative` for de-rating, `positive` for re-rating, `watch` for mixed.",
  ].join("\n"),
  sup_eps_bridge: [
    "This is the 'EPS Credibility Bridge' SUPPLEMENTARY PANEL — collapsible drawer below the memo.",
    "Required content:",
    "- `bridge`: REQUIRED when EPS / earnings findings exist. 4–6 rows MAX. Preferred metrics in this order:",
    "  1. Prior EPS estimate (from the memo)",
    "  2. Latest REPORTED EPS",
    "  3. Latest revised estimate (where sourced)",
    "  4. Key delta driver: margin",
    "  5. Key delta driver: mix / segment",
    "  6. Key delta driver: one-offs / tax / other income",
    "- `body`: 2 short paragraphs MAX — explain the key delta lines in number-led prose.",
    "- `bullets`: 2–3 max.",
    "- If no relevant findings exist, say so in 2 sentences, set `confidence: low`, omit `bridge`, and stop.",
  ].join("\n"),
  sup_financials_actuals: [
    "This is the 'Memo Forecasts vs Reported Financials' SUPPLEMENTARY PANEL — collapsible drawer below the memo.",
    "Required content:",
    "- `bridge`: REQUIRED when financials/guidance findings exist. 4–8 rows. Each row compares a memo-stated forecast vs the latest reported number. Preferred metrics:",
    "  Revenue, EBITDA, EBITDA margin, PAT, EPS, Operating cash flow, Net debt / cash, Working-capital days (whichever the memo anchored on).",
    "  - `original` cell: memo's stated expectation or assumption.",
    "  - `latest` cell: latest reported actual.",
    "  - `readThrough` cell: ONE phrase — 'memo too optimistic on margin' / 'memo conservative on growth' / 'broadly tracking', etc.",
    "- `body`: ONE short paragraph that interprets WHY the memo was right or wrong — divisional vs P&L vs balance-sheet vs cash-flow drivers (≤ 100 words).",
    "- `bullets`: omit (the bridge IS the content).",
    "- If no relevant findings exist, say so in 2 sentences, set `confidence: low`, omit `bridge`, and stop.",
  ].join("\n"),
};

export function buildSectionPrompt(
  req: GenerateMemoSectionRequest,
): BuildSectionPromptResult {
  const block = SECTION_BLOCKS[req.sectionId];
  const title = CANONICAL_SECTION_TITLES[req.sectionId];

  const systemLines = [
    ...SHARED_SYSTEM_LINES,
    "",
    `Target section: ${req.sectionId} — ${title}.`,
    block,
  ];
  if (req.retryCompact) {
    systemLines.push(
      "",
      "Compact retry: produce tighter prose. Trim bullets to 2 max, body to one short paragraph, sources to the most important 2.",
    );
  }

  return {
    system: systemLines.join("\n"),
    user: buildUserPrompt(req),
    allowedDocumentIds: collectAllowedDocumentIds(req),
  };
}

function buildUserPrompt(req: GenerateMemoSectionRequest): string {
  const {
    sectionId,
    project,
    dna,
    detection,
    relevantFindings,
    relevantCheckpointImpacts,
    positiveDevelopmentIds,
    negativeDevelopmentIds,
    watchDevelopmentIds,
    styleSample,
    initialMemoId,
    priorSectionsDigest,
    retryCompact,
  } = req;

  const lines: string[] = [];

  lines.push("# 1. Project");
  lines.push(`- Ticker: ${project.ticker}`);
  lines.push(`- Company: ${project.companyName}`);
  if (project.sector) lines.push(`- Sector: ${project.sector}`);
  if (detection) {
    lines.push(`- Memo latest period: ${detection.periodLabel}`);
    if (detection.researchStart) {
      lines.push(
        `- Research window: ${detection.researchStart} → ${detection.researchCurrent}`,
      );
    } else {
      lines.push(`- Research window end: ${detection.researchCurrent}`);
    }
    if (detection.assumptionNotes && detection.assumptionNotes.length > 0) {
      lines.push("- Period assumptions to acknowledge:");
      for (const note of detection.assumptionNotes) {
        lines.push(`  - ${note}`);
      }
    }
  }

  lines.push("");
  lines.push("# 2. Original memo DNA (compact)");
  lines.push(
    `- Tone adjectives: ${dna.styleTone.adjectives.join(", ") || "—"}`,
  );
  lines.push(
    `- Analytical framework: ${dna.analyticalFramework.join("; ") || "—"}`,
  );
  const thesisCap = retryCompact ? 200 : 400;
  lines.push(
    `- Original thesis: ${truncate(dna.originalThesis, thesisCap) || "—"}`,
  );
  const assumptionsCap = retryCompact ? 3 : 4;
  if (dna.keyAssumptions.length > 0) {
    lines.push("- Key assumptions:");
    for (const a of dna.keyAssumptions.slice(0, assumptionsCap)) {
      lines.push(`  - ${truncate(a, 200)}`);
    }
  }
  if (dna.valuationFramework) {
    const vf = dna.valuationFramework;
    lines.push(
      `- Valuation framework: ${vf.method || "—"} / ${vf.targetMultiple || "—"}`,
    );
    if (vf.bridgeNotes && vf.bridgeNotes.length > 0) {
      for (const note of vf.bridgeNotes.slice(0, 2)) {
        lines.push(`  - ${truncate(note, 200)}`);
      }
    }
  }
  const risksCap = retryCompact ? 3 : 4;
  if (dna.riskChecklist && dna.riskChecklist.length > 0) {
    lines.push("- Key risks:");
    for (const r of dna.riskChecklist.slice(0, risksCap)) {
      lines.push(
        `  - ${r.category}: ${(r.risks ?? []).slice(0, 3).join("; ") || "—"}`,
      );
    }
  }
  if (dna.thesisCheckpoints && dna.thesisCheckpoints.length > 0) {
    lines.push("- Thesis checkpoints:");
    for (const cp of dna.thesisCheckpoints.slice(0, 5)) {
      lines.push(`  - ${cp.id}: ${truncate(cp.label, 160)}`);
    }
  }

  if (styleSample && styleSample.length > 0) {
    lines.push("");
    lines.push("# 3. Original style sample");
    const sampleCap = retryCompact ? 3 : 5;
    const totalCap = retryCompact ? 800 : 1500;
    let running = 0;
    for (const s of styleSample.slice(0, sampleCap)) {
      const cleaned = s.trim();
      if (!cleaned) continue;
      if (running + cleaned.length > totalCap) break;
      lines.push(`"${cleaned}"`);
      running += cleaned.length;
    }
  }

  lines.push("");
  lines.push("# 4. Research findings RELEVANT to this section");
  if (!relevantFindings || relevantFindings.length === 0) {
    lines.push(
      "_No research findings were selected as relevant to this section. Follow the section block's no-findings instructions._",
    );
  } else {
    const findingCap = retryCompact ? 4 : 6;
    const summaryCap = retryCompact ? 800 : 1500;
    const sourceCap = retryCompact ? 3 : 4;
    for (const f of relevantFindings.slice(0, findingCap)) {
      lines.push(`## ${f.id} [${f.category}] ${f.title}`);
      const watchHint =
        f.impact === "watch"
          ? " (watch — counts as partial validator)"
          : "";
      lines.push(`Impact: ${f.impact}${watchHint}`);
      lines.push(`Summary: ${truncate(f.summary, summaryCap)}`);
      lines.push(`Relevance: ${truncate(f.relevance, summaryCap)}`);
      if (f.sources.length > 0) {
        lines.push("Sources:");
        for (const s of f.sources.slice(0, sourceCap)) {
          const verified = s.verifiedByWebSearch ? " · verified" : "";
          const tier = s.tier ? ` · tier:${s.tier}` : "";
          const date = s.date ? ` · ${s.date}` : "";
          lines.push(`  - ${s.title}${date}${tier}${verified}: ${s.url}`);
        }
      } else {
        lines.push("Sources: (none — contribute color only)");
      }
      lines.push("");
    }
  }

  // Phase 6A: memo-specific anchor. When present, give the section a
  // memo-anchored "what the original memo argued" recap so the section
  // body answers "does this still hold?" rather than drifting into
  // generic company commentary.
  if (req.memoUnderstandingDigest) {
    appendMemoUnderstandingContext(lines, sectionId, req.memoUnderstandingDigest);
  }

  // Phase 6C: user-supplied priorities. The dashboard's "What else should
  // we test?" textbox surfaces here so every section knows the user's
  // explicit asks. The model is told to weave these in where they fit
  // the section's scope (without forcing them into sections where they
  // don't belong).
  appendUserPrioritiesBlock(lines, req.userPriorities);

  lines.push("# 5. Cross-finding context");
  if (positiveDevelopmentIds && positiveDevelopmentIds.length > 0) {
    lines.push(
      `- Positive (memo HELD) finding ids: ${positiveDevelopmentIds.join(", ")}`,
    );
  }
  if (negativeDevelopmentIds && negativeDevelopmentIds.length > 0) {
    lines.push(
      `- Negative (memo BROKE) finding ids: ${negativeDevelopmentIds.join(", ")}`,
    );
  }
  if (watchDevelopmentIds && watchDevelopmentIds.length > 0) {
    lines.push(
      `- Watch (still partial) finding ids: ${watchDevelopmentIds.join(", ")}`,
    );
  }
  if (relevantCheckpointImpacts && relevantCheckpointImpacts.length > 0) {
    lines.push("- Thesis checkpoints touching this section:");
    for (const c of relevantCheckpointImpacts) {
      lines.push(
        `  - ${c.checkpointId} → ${c.impact}: ${truncate(c.note, 240)}`,
      );
    }
  }

  if (
    sectionId === "sec_investment_action" &&
    priorSectionsDigest &&
    priorSectionsDigest.length > 0
  ) {
    lines.push("");
    lines.push("# 5b. Prior section conclusions");
    lines.push(
      "Use these to compute the Provisional action / Classification / Why bullets / What would change the call / Top 3 to monitor.",
    );
    for (const d of priorSectionsDigest) {
      const conf = d.confidence ? `, confidence=${d.confidence}` : "";
      lines.push(
        `- ${d.id}: signal=${d.signal}${conf}, summary="${truncate(d.summary, 250)}"`,
      );
      if (d.topBullets && d.topBullets.length > 0) {
        for (const b of d.topBullets.slice(0, 3)) {
          lines.push(`  - ${truncate(b, 200)}`);
        }
      }
    }
  }

  lines.push("");
  lines.push("# 6. Available document IDs");
  lines.push("Cite ONLY these documentIds:");
  if (initialMemoId) {
    lines.push(`- ${initialMemoId} → original memo`);
  }
  if (relevantFindings && relevantFindings.length > 0) {
    for (const f of relevantFindings) {
      lines.push(`- ${f.id} → research finding (${f.category})`);
    }
  }

  lines.push("");
  lines.push("# 7. Output requirements");
  lines.push(
    `- Emit EXACTLY ONE MemoSection JSON object with id="${sectionId}", title="${CANONICAL_SECTION_TITLES[sectionId]}".`,
  );
  lines.push(
    "- Required fields: id, title, summary, body, bullets, signal, sources.",
  );
  lines.push(
    "- Optional fields: confidence (high|medium|low), confidenceNote (one short sentence), bridge (rows of { metric, original?, latest?, readThrough? }).",
  );
  lines.push(
    "- For each source, include documentId (required) plus optional page and quote.",
  );
  lines.push(
    "- Do NOT write 'Needs manual verification' anywhere in the section.",
  );
  lines.push(
    "- Do NOT emit any other section id, and do NOT emit prose outside the JSON.",
  );

  return lines.join("\n");
}

function collectAllowedDocumentIds(
  req: GenerateMemoSectionRequest,
): Set<string> {
  const set = new Set<string>();
  if (req.initialMemoId) set.add(req.initialMemoId);
  for (const f of req.relevantFindings ?? []) set.add(f.id);
  return set;
}

function truncate(value: string, max: number): string {
  if (typeof value !== "string") return "";
  const s = value.trim();
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

function appendUserPrioritiesBlock(
  lines: string[],
  userPriorities: string | undefined,
): void {
  if (typeof userPriorities !== "string") return;
  const trimmed = userPriorities.trim();
  if (trimmed.length === 0) return;
  const capped =
    trimmed.length > 1500 ? `${trimmed.slice(0, 1499)}…` : trimmed;
  lines.push("");
  lines.push("# 4c. User-supplied priorities for this memo");
  lines.push(
    "The portfolio manager explicitly asked us to address the items below. Weave them into THIS section ONLY where they fit the section's scope; if they don't fit here, they will be picked up by another section. Never invent evidence to address them.",
  );
  for (const raw of capped.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[-•*]/.test(line)) {
      lines.push(line);
    } else {
      lines.push(`- ${line}`);
    }
  }
  lines.push("");
}

// Phase 6A: memo-understanding anchor block for section prompts.
// Provides the section model with the original memo's anchor — thesis
// pillars, flagged details, financial claims — so the section can answer
// "does the memo still hold?" rather than drift generic.
const MEMO_ANCHOR_SECTIONS = new Set<CanonicalSectionId>([
  "sec_thesis_scorecard",
  "sec_what_changed",
  "sec_shareholding",
  "sec_industry_regulatory",
  "sec_corporate_events",
  "sec_investment_action",
  "sup_valuation_detail",
  "sup_eps_bridge",
  "sup_financials_actuals",
]);

const FINANCIALS_SECTIONS = new Set<CanonicalSectionId>([
  "sec_thesis_scorecard",
  "sup_valuation_detail",
  "sup_eps_bridge",
  "sup_financials_actuals",
]);

function appendMemoUnderstandingContext(
  lines: string[],
  sectionId: CanonicalSectionId,
  digest: MemoUnderstandingDigest,
): void {
  lines.push("");
  lines.push("# 4b. Original memo's anchor");
  lines.push(
    `Original memo's one-line thesis: ${digest.oneLineSummary || "—"}`,
  );
  if (digest.recommendation || digest.targetPrice) {
    const rec = digest.recommendation ?? "—";
    const tgt = digest.targetPrice ? ` · target ${digest.targetPrice}` : "";
    lines.push(`Original recommendation: ${rec}${tgt}`);
  }
  if (digest.valuation.method || digest.valuation.targetMultiple) {
    const method = digest.valuation.method ?? "—";
    const multiple = digest.valuation.targetMultiple ?? "—";
    const eps = digest.valuation.impliedEPS
      ? ` · EPS basis ${digest.valuation.impliedEPS}`
      : "";
    lines.push(`Original valuation framework: ${method} / ${multiple}${eps}`);
  }
  if (digest.thesisPillars.length > 0) {
    lines.push("Top thesis pillars (must_check first):");
    for (const p of digest.thesisPillars.slice(0, 5)) {
      lines.push(`- [${p.researchPriority}] ${truncate(p.label, 140)}`);
    }
  }
  if (digest.flaggedDetails.length > 0) {
    lines.push("Memo-flagged details:");
    for (const f of digest.flaggedDetails.slice(0, 5)) {
      lines.push(
        `- [${f.category} · ${f.importance}] ${truncate(f.label, 100)} — ${truncate(f.whyItMatters, 180)}`,
      );
    }
  }
  if (
    FINANCIALS_SECTIONS.has(sectionId) &&
    digest.financialClaims.length > 0
  ) {
    lines.push("Financial claims the memo anchored on (relevant to this section):");
    for (const c of digest.financialClaims.slice(0, 4)) {
      const period = c.period ? ` (${c.period})` : "";
      lines.push(
        `- ${c.metric} = ${c.value}${period} [${c.claimType}] — ${truncate(c.whyItMatters, 160)}`,
      );
    }
  }
  if (MEMO_ANCHOR_SECTIONS.has(sectionId)) {
    lines.push(
      "Use these anchors to evaluate whether the memo still holds — do NOT drift into generic company commentary. Tie each section claim back to a specific pillar / flag / claim above.",
    );
  }
  lines.push("");
}
