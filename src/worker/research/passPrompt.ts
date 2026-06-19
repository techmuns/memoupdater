import type {
  MemoUnderstandingDigest,
  MemoUnderstandingResearchTask,
  ResearchPassCompanyAliases,
  ResearchPassId,
  ResearchPassRequest,
} from "@shared/types";

export const RESEARCH_PASS_IDS: readonly ResearchPassId[] = [
  "official_results",
  "management_call",
  "investor_presentation",
  "press_and_results",
  "valuation_market",
  "risks_competition",
] as const;

export const RESEARCH_PASS_TITLES: Record<ResearchPassId, string> = {
  official_results: "Official results / exchange filings",
  management_call: "Earnings call / management commentary",
  investor_presentation: "Investor presentation / IR deck",
  press_and_results: "Financial press / result summaries",
  valuation_market: "Valuation / market movement",
  risks_competition: "Risks / macro / competition / AI",
};

export interface BuildResearchPassPromptResult {
  system: string;
  user: string;
}

const SHARED_SYSTEM_LINES = [
  "You are a buy-side investment analyst running ONE focused research pass on a public company you are following.",
  "Your job in THIS pass is to discover developments — in the narrow scope below — between the detected memo period and today that materially affect the original investment thesis.",
  "",
  "Hard rules:",
  "- Use only sources you actually found via the web_search tool. NEVER invent URLs, dates, publishers, or quotes.",
  "- If you cannot find any usable source for this pass, return findings: [] with a warning that says so. That is a legitimate, non-failing outcome — the orchestrator combines this pass with five others.",
  "- For each finding you DO emit, give a short stable id (e.g. 'f01', 'f02'), classify it under one of the schema's enumerated categories, choose impact ∈ {positive, negative, neutral, watch}.",
  "- Write `summary` in 2–4 sentences max. Write `relevance` in 1–2 sentences. Number-led where possible. No generic hedging. No fake precision.",
  "- Forward-guidance discipline (HARD): report forward guidance, price targets, or future-period numbers ONLY when a source EXPLICITLY attributes that number to the company or its management. If the company disclosed no guidance, do NOT manufacture one — say 'no forward guidance disclosed' in the finding. Never emit a next-year revenue / margin / EPS figure the sources do not contain.",
  "- Numbers: capture ABSOLUTE figures with their unit/currency alongside any percentage. When both a REPORTED and an 'adjusted' figure exist, capture both and note the gap — do not silently report only the adjusted one.",
  "- Claims vs verifiable facts: tag management's qualitative claims ('ahead of plan', 'margins improving', 'synergies on track', 'no real competition') as claims to verify — never as confirmed outcomes. An unverified management claim is at most impact `watch`.",
  "- Cite every source you used. Each source object MUST carry title, url, tier, and (when known) date and a short note.",
  "- Source priority (HARD ranking — never upgrade a source you cannot verify): official > company > exchange > transcript > press > market_data > other. The server will only ever DOWNGRADE your tier — never upgrade — so be honest.",
  "- The HIGHEST-tier source must come first in each finding's `sources[]`.",
  "- If your only source is `press` / `market_data` / `other`, set impact to `watch` or `neutral` (the server will downgrade non-neutral findings without a primary-tier verified source).",
  "- If a finding clearly maps to one of the thesis checkpoints provided in the user prompt, set thesisCheckpointId to that checkpoint id; otherwise null.",
  "- Emit a SINGLE JSON object matching the schema (`findings`, `unresolvedQuestions`, `warnings`). No prose outside the JSON.",
];

const PASS_BLOCKS: Record<ResearchPassId, string> = {
  official_results: [
    "Pass: OFFICIAL RESULTS / EXCHANGE FILINGS / SHAREHOLDING PATTERN.",
    "Scope: cover (a) the latest quarterly / annual / interim official results AND (b) the latest SHAREHOLDING PATTERN.",
    "Preferred sources: company investor relations page, BSE/NSE/SEC/SEBI filings, official earnings releases, 10-K/10-Q/20-F documents, BSE/NSE shareholding-pattern filings, Screener.in 'Shareholding' page (treat as aggregator of filings).",
    "Categories: financials, filings, guidance.",
    "EFFICIENCY (HARD): keep this pass FAST. Run at most 2–3 web_search calls total — one for the latest results, one for the shareholding pattern. Do NOT keep searching for more sources once you have a primary doc for each. Target 2–3 findings total.",
    "Exactly ONE finding MUST cover the shareholding pattern (category: 'filings'). Quote SPECIFIC percentages AND, where the filing or Screener.in surfaces them, NAMED institutional holders (e.g. 'HDFC Mutual Fund added 1.4 ppt to 3.1%', 'Government Pension Fund Global exited'). Do NOT invent fund names. Cover, in priority order: promoter holding + pledge, FII holding (name top movers), DII / mutual-fund holding (name top movers), public/retail, plus any QIP / preferential / buyback / insider trade visible — but a single percentages-only finding is acceptable if named movers aren't surfaced in your first search.",
    "GOVERNANCE / ACCOUNTING-QUALITY scan (capture as findings when the results or filings surface them — these are thesis-altering and often missed): KMP changes (CFO/CEO/auditor resignations or repeated churn), auditor change or qualifications, a shift from net-cash to net-debt or rising leverage, working-capital / receivable-days deterioration, heavy reliance on 'adjusted' EBITDA/PAT vs reported (and the SIZE of the gap), promoter-pledge changes, related-party transactions, contingent liabilities / corporate guarantees. Emit under category 'filings' or 'financials' with impact 'watch' or 'negative' as warranted.",
    "DEAL ECONOMICS: if a material acquisition / divestment / fund-raise occurred in the window, capture its SIZE and HOW it was funded (debt vs equity/QIP — note dilution) and any guarantees. State absolute figures.",
    "If only press summaries exist (no primary doc), emit a coverage-gap finding (impact: neutral, category: 'filings') saying so.",
  ].join("\n"),
  management_call: [
    "Pass: EARNINGS CALL / MANAGEMENT COMMENTARY.",
    "Scope: find the company's most recent earnings call transcript / concall highlights and extract a structured review.",
    "Preferred sources: company-hosted transcripts, exchange filings of the earnings call, Seeking Alpha / Motley Fool transcripts, Reuters/Bloomberg call summaries.",
    "Categories: management, broker_consensus, guidance.",
    "Target 1–3 findings. Extract, where the call actually covered it: (a) management GUIDANCE for revenue growth, margins, capex, working capital, cash flow, debt and return ratios — quote ONLY numbers management actually stated, else 'no guidance disclosed'; (b) on any M&A: synergy quantum, integration progress, cost/revenue synergies, execution timeline; (c) how management addressed major risks (AI disruption, demand/margin/pricing pressure, regulation, competition, customer concentration); (d) where analysts pushed back or challenged assumptions; (e) whether management answered directly with evidence or vaguely/promotionally.",
    "For every finding, DISTINGUISH management CLAIMS from independently verifiable facts — label unverified claims and set impact 'watch'. Also surface any MANAGEMENT / BOARD change mentioned (CEO/CFO/auditor departure, KMP exit) as a 'management' finding.",
    "If no transcript or call summary is available for the latest period, emit a coverage-gap finding (impact: neutral, category: 'management').",
  ].join("\n"),
  investor_presentation: [
    "Pass: INVESTOR PRESENTATION / IR DECK.",
    "Scope: find the company's most recent investor presentation / results deck / IR slides for the detected period.",
    "Preferred sources: company IR pages, exchange-filed presentations, official PDF decks.",
    "Categories: management, financials, guidance.",
    "Target 1–2 findings. Pull headline slides (segment growth, capacity, capex plan, guidance, valuation anchors).",
    "If no investor presentation can be located for the latest period, emit a coverage-gap finding (impact: neutral).",
  ].join("\n"),
  press_and_results: [
    "Pass: FINANCIAL PRESS / RESULT SUMMARIES.",
    "Scope: find credible business-press summaries of the latest results — ONLY to supplement or substitute when official sources are unavailable.",
    "Preferred sources: Reuters, Bloomberg, FT, WSJ, CNBC, Economic Times, Mint, Business Standard, Moneycontrol, BusinessLine.",
    "Categories: financials, management, broker_consensus, peers, other.",
    "Target 1–3 findings. NEVER assert a positive/negative directional claim from press alone — set impact to `watch` when your only source is press. The server will enforce this rule.",
    "If only aggregator/blog sources are available (no credible press), emit a coverage-gap finding (impact: neutral, category: 'other').",
  ].join("\n"),
  valuation_market: [
    "Pass: VALUATION / MARKET MOVEMENT.",
    "Scope: find the CURRENT (today's) share price, recent valuation multiples (P/E, EV/EBITDA, P/B, FCF yield), market cap, share-price moves, broker target prices, peer-set comparisons.",
    "AUTHORITATIVE LIVE DATA: if '# 1. Company identity' carries a 'Current price (server-fetched, live)' line — and/or a 'Fundamentals (server-fetched, live, do NOT re-verify)' line — those numbers are AUTHORITATIVE for this run. Do NOT spend a web_search call on the current price, trailing/forward EPS, trailing/forward P/E, market cap or 52-week range; use them verbatim and spend the saved budget on multiples-vs-peers, target-price discovery and segment-level reads. ONLY when those lines are absent should you do a live-quote web_search of the form '<companyName> share price' / '<ticker> stock price today'; acceptable live-quote sources are Google Finance, Yahoo Finance, NSE/BSE/SEC/SEBI quote pages, Bloomberg, Reuters, Tickertape, Screener.in. Capture price together with its as-of date.",
    "Preferred sources for the rest of the pass: Screener.in, Tickertape, Yahoo Finance, TradingView, WSJ market data, broker-note summaries from credible press.",
    "Categories: valuation, peers, broker_consensus.",
    "Target 1–3 findings. Quote exact multiples / prices verbatim from the source — never paraphrase numerically.",
    "Report a SINGLE representative CURRENT trailing P/E and a SINGLE forward P/E (and likewise for EV/EBITDA) — NEVER a wide nonsensical range (e.g. '46x–186x'). If sources disagree, use the most recent value and state the basis (consolidated; reported vs adjusted EPS).",
    "Capture, where sourced, the inputs the valuation bridge needs: current price (with date), market cap, enterprise value, trailing AND forward P/E, trailing AND forward EV/EBITDA, P/B, FCF yield, 52-WEEK RANGE; the absolute return since the memo date with its ANNUALISED (CAGR) figure and the relevant INDEX return over the same window; and 1–2 key PEER multiples for the peer gap.",
    "CURRENT-PRICE FRESHNESS (HARD): every quoted current price MUST carry an explicit as-of date. Reject any price more than ~10 calendar days old — it is STALE. If only stale prices were found, the finding must say 'current price not located today — last quote: <date> <value>; refresh required' and set impact 'watch'. Stock-price-derived current metrics (market cap, EV, trailing P/E, EV/EBITDA) inherit the same freshness rule.",
    "Sanity-check any sourced price against the 52-week range and flag (impact: watch) anything outside it.",
    "Do NOT invent numbers. Do NOT silently pass through an old quote as if it were today's.",
  ].join("\n"),
  risks_competition: [
    "Pass: RISKS / MACRO / COMPETITION / AI.",
    "Scope: find recent developments in macro environment, regulatory changes, competitive moves, AI / technology risk where genuinely material to the thesis.",
    "Preferred sources: Reuters/Bloomberg/FT for macro+regulatory, peer-company filings/transcripts for competitive moves, credible analyst notes for AI/tech risk.",
    "Categories: macro, peers, ai_tech_risk, other.",
    "Target 1–3 findings. Each must tie to a thesis assumption or checkpoint — generic 'macro is uncertain' framing is not allowed.",
    "If nothing material surfaced in this pass, emit a single coverage-gap finding (impact: neutral, category: 'other').",
  ].join("\n"),
};

export function buildResearchPassPrompt(
  req: ResearchPassRequest,
): BuildResearchPassPromptResult {
  const block = PASS_BLOCKS[req.passId];
  const title = RESEARCH_PASS_TITLES[req.passId];

  const systemLines = [
    ...SHARED_SYSTEM_LINES,
    "",
    `Target pass: ${req.passId} — ${title}.`,
    block,
  ];
  if (req.retryCompact) {
    systemLines.push(
      "",
      "Compact retry: aim for 1–2 findings only, tighter prose, max 2 sources per finding.",
    );
  }

  return {
    system: systemLines.join("\n"),
    user: buildUserPrompt(req),
  };
}

function buildUserPrompt(req: ResearchPassRequest): string {
  const { project, companyAliases, dna, detection, thesisCheckpoints, retryCompact } = req;
  const lines: string[] = [];

  lines.push("# 1. Company identity");
  lines.push("Search across ALL aliases below; prefer the most official form when emitting source titles:");
  for (const alias of formatAliases(companyAliases)) {
    lines.push(`- ${alias}`);
  }
  if (project.sector) lines.push(`- Sector: ${project.sector}`);
  if (detection.memoWrittenOn) {
    lines.push(`- Original memo written on (server-extracted): ${detection.memoWrittenOn}`);
  }
  if (detection.currentPrice) {
    // Server-fetched live quote + fundamentals. For the valuation_market
    // pass this means SKIP the live-price + EPS + P/E + 52w web_searches —
    // use these verbatim and spend the saved budget on multiples basis,
    // peers and target-price discovery. For other passes it's just context.
    const cp = detection.currentPrice;
    lines.push(
      `- Current price (server-fetched, live — DO NOT search for an alternative): ${cp.display}  [value=${cp.value} ${cp.currency}, asOf=${cp.asOf}, source=${cp.source}]`,
    );
    if (cp.fundamentalsDisplay) {
      lines.push(
        `- Fundamentals (server-fetched, live, do NOT re-verify): ${cp.fundamentalsDisplay}`,
      );
    }
  }

  lines.push("");
  lines.push("# 2. Research window");
  lines.push(`- Memo latest period (label only): ${detection.periodLabel}`);
  if (detection.researchStart) {
    lines.push(
      `- Look for developments BETWEEN ${detection.researchStart} and ${detection.researchCurrent} (inclusive).`,
    );
  } else {
    lines.push(
      `- Memo period is fiscal-label-only (no calendar mapping). Look for developments from the most recent quarter attributable to the company, through ${detection.researchCurrent}. Acknowledge this assumption in warnings[].`,
    );
  }
  // Phase 6F.2: nudge the model toward the NEXT reporting period after
  // the memo's stated quarter. The original prompt asked for "developments
  // between memo date and today" which is correct but doesn't say
  // "specifically the next print." Most of the high-signal data points
  // since the memo are the next quarter's results + the next annual
  // report — naming that explicitly lifts coverage materially.
  const nextHints = nextReportingHints(detection.periodLabel);
  if (nextHints.length > 0) {
    lines.push("- The MOST IMPORTANT data points to find are:");
    for (const h of nextHints) lines.push(`  - ${h}`);
  }
  if (detection.assumptionNotes && detection.assumptionNotes.length > 0) {
    lines.push("- Period assumption notes to acknowledge:");
    for (const note of detection.assumptionNotes) lines.push(`  - ${note}`);
  }

  lines.push("");
  lines.push("# 3. Original thesis context (compact — NO full memo text)");
  if (dna.originalThesisHead) {
    lines.push(`- Original thesis: ${dna.originalThesisHead}`);
  }
  if (dna.toneAdjectives.length > 0) {
    lines.push(`- Memo tone adjectives: ${dna.toneAdjectives.join(", ")}`);
  }
  if (dna.analyticalFramework.length > 0) {
    lines.push(`- Analytical framework: ${dna.analyticalFramework.join("; ")}`);
  }
  const assumptionCap = retryCompact ? 3 : 4;
  if (dna.keyAssumptions.length > 0) {
    lines.push("- Key assumptions:");
    for (const a of dna.keyAssumptions.slice(0, assumptionCap)) {
      lines.push(`  - ${a}`);
    }
  }
  const vf = dna.valuationFramework;
  if (vf) {
    lines.push(
      `- Valuation framework: ${vf.method || "—"} / ${vf.targetMultiple || "—"}`,
    );
    if (vf.bridgeNotes && vf.bridgeNotes.length > 0) {
      for (const note of vf.bridgeNotes.slice(0, 2)) {
        lines.push(`  - ${note}`);
      }
    }
  }

  const checkpoints =
    thesisCheckpoints && thesisCheckpoints.length > 0
      ? thesisCheckpoints
      : dna.thesisCheckpoints.map((cp) => ({
          id: cp.id,
          label: cp.label,
          expectedDirection: cp.expectedDirection,
          rationale: "",
          sources: [],
        }));

  lines.push("");
  lines.push("# 4. Thesis checkpoints to test (use checkpoint ids in `thesisCheckpointId`)");
  if (checkpoints.length === 0) {
    lines.push("_No structured checkpoints provided. Use null for thesisCheckpointId._");
  } else {
    for (const c of checkpoints.slice(0, 5)) {
      lines.push(
        `- ${c.id}: ${c.label} (expected direction: ${c.expectedDirection})`,
      );
    }
  }

  // Phase 6A: memo-specific anchor for this pass. Rendered only when the
  // request carries both a MemoUnderstanding digest AND a non-empty list
  // of pass-specific research tasks (selected client-side via
  // selectTasksForPass). When this block is present, research findings
  // MUST tie back to memo-specific questions instead of generic company
  // coverage.
  if (
    req.memoUnderstandingDigest &&
    req.passMemoTasks &&
    req.passMemoTasks.length > 0
  ) {
    appendMemoSpecificBlock(
      lines,
      req.memoUnderstandingDigest,
      req.passMemoTasks,
    );
  }

  // Phase 6C: user-supplied priorities. Rendered when the dashboard's
  // "What else should we test?" textbox carries non-empty text. The
  // model is told to ALSO validate these items where they fall within
  // this pass's scope, but only WHERE THEY FALL — the orchestrator will
  // surface them across other passes too.
  appendUserPrioritiesBlock(lines, req.userPriorities);

  lines.push("");
  lines.push("# 5. Output requirements");
  lines.push(
    "- Use web_search to find primary sources for the SCOPE of THIS pass only.",
  );
  lines.push(
    "- Quote URLs verbatim — do not paraphrase or rewrite them.",
  );
  lines.push(
    "- Set `tier` on EVERY source (official / company / exchange / transcript / press / market_data / other).",
  );
  lines.push(
    "- Every finding with impact ≠ neutral must carry at least one source with a working url.",
  );
  lines.push(
    "- If your only sources are press / market_data / other, set impact to `watch` — the server will downgrade otherwise.",
  );
  lines.push(
    "- Findings emitted by THIS pass should align with the scope block at the top of the system prompt. Do NOT try to cover OTHER passes' scopes — the orchestrator will combine you with five focused siblings.",
  );
  lines.push(
    "- Emit a single JSON object that matches the schema. No prose outside the JSON.",
  );

  return lines.join("\n");
}

function appendMemoSpecificBlock(
  lines: string[],
  digest: MemoUnderstandingDigest,
  tasks: MemoUnderstandingResearchTask[],
): void {
  lines.push("");
  lines.push("# Memo-specific anchor for this pass");
  lines.push(
    `The user's original memo specifically believed: ${digest.oneLineSummary}`,
  );
  if (digest.recommendation) {
    const target = digest.targetPrice ? ` · target ${digest.targetPrice}` : "";
    lines.push(`Original recommendation: ${digest.recommendation}${target}`);
  }
  if (digest.valuation.method || digest.valuation.targetMultiple) {
    const method = digest.valuation.method ?? "—";
    const multiple = digest.valuation.targetMultiple ?? "—";
    const eps = digest.valuation.impliedEPS
      ? ` · EPS basis ${digest.valuation.impliedEPS}`
      : "";
    lines.push(`Original valuation anchor: ${method} / ${multiple}${eps}`);
  }
  if (digest.thesisPillars.length > 0) {
    lines.push("Thesis pillars this pass should check:");
    for (const p of digest.thesisPillars) {
      lines.push(`- [${p.researchPriority}] ${p.label}`);
    }
  }
  if (digest.flaggedDetails.length > 0) {
    lines.push("Flagged details this pass should specifically update:");
    for (const f of digest.flaggedDetails) {
      lines.push(
        `- [${f.category} · ${f.importance}] ${f.label} — ${f.whyItMatters}`,
      );
    }
  }
  lines.push("Research questions this pass must answer:");
  for (const t of tasks) {
    lines.push(`- ${t.question}  (anchored on: ${t.memoAnchor})`);
  }
  lines.push("For each finding you emit:");
  lines.push(
    "- set `thesisCheckpointId` when applicable (existing rule);",
  );
  lines.push(
    "- set `linkedFlagId` to the flagged-detail id if the finding directly updates that flag;",
  );
  lines.push(
    "- set `linkedResearchTaskId` to the task id if the finding answers a queued question.",
  );
}

function appendUserPrioritiesBlock(
  lines: string[],
  userPriorities: string | undefined,
): void {
  if (typeof userPriorities !== "string") return;
  const trimmed = userPriorities.trim();
  if (trimmed.length === 0) return;
  // Cap to keep prompts bounded; 1500 chars is roughly 8–15 short items.
  const capped =
    trimmed.length > 1500 ? `${trimmed.slice(0, 1499)}…` : trimmed;
  lines.push("");
  lines.push("# User-supplied research priorities");
  lines.push(
    "The user (a portfolio manager) explicitly asked us to ALSO validate the items below. Where any of them falls within THIS pass's scope, treat it as a high-priority research question and try to source it. Where it does not, leave it for a sibling pass — do not stretch this pass beyond its scope.",
  );
  // Render the user text verbatim, line by line, with leading dashes for
  // any line that doesn't already look like a bullet.
  for (const raw of capped.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[-•*]/.test(line)) {
      lines.push(line);
    } else {
      lines.push(`- ${line}`);
    }
  }
}

// Phase 6F.2: parse the memo's period label and emit hints for the
// next reporting period the research model should hunt down. The hints
// are conservative — they only fire when we can identify a quarter or
// fiscal year, and they describe what the LIKELY NEXT data point is
// without claiming a calendar date.
function nextReportingHints(periodLabel: string): string[] {
  if (typeof periodLabel !== "string" || periodLabel.length === 0) return [];
  const out: string[] = [];
  const upper = periodLabel.toUpperCase();

  // Quarter parsing — e.g. "3QFY26", "Q3 FY26", "3Q26"
  const qm = upper.match(/\bQ?([1-4])\s*Q?\s*FY?\s*(\d{2,4})\b/);
  if (qm) {
    const q = parseInt(qm[1], 10);
    const fy = qm[2].length === 2 ? `FY${qm[2]}` : `FY${qm[2].slice(-2)}`;
    if (q < 4) {
      const nextQ = `Q${q + 1}${fy}`;
      out.push(
        `The memo covers Q${q}${fy}; the NEXT print is ${nextQ} — find its result release, earnings call transcript, and any management commentary on the same drivers the memo discussed.`,
      );
      if (q === 3) {
        out.push(
          `Q4${fy} is typically released alongside the ${fy} annual results / ${fy} annual report — explicitly look for the ${fy} annual report (auditor remarks, related-party transactions, full shareholding pattern).`,
        );
      }
    } else {
      const nextFy = `FY${(parseInt(fy.slice(2), 10) + 1).toString().padStart(2, "0")}`;
      out.push(
        `The memo covers Q4${fy} / ${fy}; the NEXT print is Q1${nextFy} — find its result release, earnings call transcript, and any guidance update.`,
      );
      out.push(
        `The ${fy} annual report is typically published 2–4 months after Q4 results; look for auditor remarks, related-party transactions, full shareholding pattern.`,
      );
    }
  } else {
    // Fiscal-year only
    const fm = upper.match(/\bFY\s*(\d{2,4})\b/);
    if (fm) {
      const fy = fm[1].length === 2 ? `FY${fm[1]}` : `FY${fm[1].slice(-2)}`;
      const nextFy = `FY${(parseInt(fy.slice(2), 10) + 1).toString().padStart(2, "0")}`;
      out.push(
        `The memo anchors on ${fy} numbers; the NEXT data points to find are Q1${nextFy} / Q2${nextFy} results since the memo was written.`,
      );
      out.push(
        `Also look for the ${fy} annual report and any rating actions / target-price revisions by other brokers since the memo.`,
      );
    }
  }
  // Generic — fires when no quarter could be parsed.
  if (out.length === 0) {
    out.push(
      "The memo is anchored on the period above. Find: (a) the next quarterly result release after this memo, (b) the next earnings call transcript, (c) the latest shareholding pattern filing, (d) any rating or target-price revisions since the memo date.",
    );
  }
  return out;
}

function formatAliases(aliases: ResearchPassCompanyAliases): string[] {
  const out: string[] = [];
  out.push(`Long name: ${aliases.longName}`);
  if (aliases.shortName && aliases.shortName !== aliases.longName) {
    out.push(`Short name: ${aliases.shortName}`);
  }
  if (aliases.informalName && aliases.informalName !== aliases.shortName) {
    out.push(`Informal name: ${aliases.informalName}`);
  }
  if (aliases.ticker) out.push(`Ticker: ${aliases.ticker}`);
  if (aliases.exchangeTicker) {
    out.push(`Exchange ticker: ${aliases.exchangeTicker}`);
  }
  if (
    aliases.exchangeTickerAlt &&
    aliases.exchangeTickerAlt !== aliases.exchangeTicker
  ) {
    out.push(`Exchange ticker (alt): ${aliases.exchangeTickerAlt}`);
  }
  if (aliases.ric) out.push(`RIC: ${aliases.ric}`);
  return out;
}
