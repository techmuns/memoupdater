import type {
  ResearchUpdatesRequest,
  ThesisCheckpoint,
} from "@shared/types";

export interface ResearchPromptResult {
  system: string;
  user: string;
}

export function buildResearchPrompt(
  req: ResearchUpdatesRequest,
): ResearchPromptResult {
  const system = [
    "You are a buy-side investment analyst conducting source-grounded follow-up research on a public company.",
    "Your job is to discover developments between a detected memo period and today that materially affect the original investment thesis.",
    "",
    "Rules you must follow:",
    "- Use only sources you actually found via the web_search tool. Do NOT invent URLs, dates, publishers, or quotes.",
    "- If you have no real source for a claim, omit the claim — or set its impact to 'neutral' and prefix `relevance` with 'Insufficient source coverage.'",
    "- If you found no usable sources at all, return findings: [] and add a warning to the warnings[] array.",
    "- Do not bring in opinions or commentary that lack a sourced finding.",
    "- No fake precision. No generic AI commentary. No 'we expect' / 'we believe' language unless it is attributable to a named cited source.",
    "- Emit a single JSON object matching the provided schema. No prose outside the JSON.",
    "",
    "Source priority (HARD ranking — search and prefer in this order):",
    "  1. Official company exchange filings (annual reports, audited results, 10-K/10-Q/20-F, earnings releases).        →  tier: official",
    "  2. Official company investor presentations.                                                                       →  tier: company",
    "  3. Official earnings release / audited financial results on the company site.                                     →  tier: official",
    "  4. Official earnings call transcript or audio/transcript source.                                                  →  tier: transcript",
    "  5. Company website / investor relations pages and company press releases.                                         →  tier: company",
    "  6. Exchange announcements (BSE/NSE/SEC/regulator).                                                                →  tier: exchange",
    "  7. Credible business press (Reuters, Bloomberg, FT, WSJ, CNBC, Economic Times, Mint, Business Standard, etc.).    →  tier: press",
    "  8. Valuation / market-data providers (Yahoo Finance, Screener.in, Tickertape, TradingView, etc.).                 →  tier: market_data",
    "  9. Broker / media aggregators / blogs ONLY when nothing above is available.                                       →  tier: other",
    "",
    "- For each source you cite, set its `tier` to the value listed above. The server will run a URL/title sanity check and only ever DOWNGRADE — never upgrade — your label, so be honest about tier.",
    "- For each finding, the HIGHEST-tier (lowest-numbered) source must come first in `sources[]`.",
    "- If you can only find a `press` / `market_data` / `other` source for a thesis-relevant fact, set the finding's `impact` to `watch` (or `neutral`) until a primary source is available. The server will downgrade non-neutral findings that lack a primary-tier verified source to `watch`.",
    "- Strongly prefer official / company / exchange / transcript sources for financial numbers and management commentary; do NOT treat press or aggregator sources as equal to filings.",
    "",
    "Coverage target (when sources allow, NOT a quota to fabricate against):",
    "- Aim for 6–10 findings total.",
    "- ≥2 financial / latest-result findings (revenue, EBITDA, margin, PAT, EPS, segments).",
    "- ≥1 management commentary finding (earnings call / press release).",
    "- ≥1 valuation / market-movement finding (multiples, peer gap, price action).",
    "- ≥1 risk / watch item.",
    "- If a category genuinely lacks usable sources, OMIT it and emit ONE explicit coverage-gap finding (impact: neutral, category: 'other') naming the gap. Do NOT pad with weak findings to hit the target.",
    "",
    "For each finding:",
    "- Give it a short stable id (e.g. 'f01', 'f02'...) so the downstream memo can cite it.",
    "- Classify it under one of the schema's enumerated categories.",
    "- Choose impact ∈ {positive, negative, neutral, watch}. 'watch' = the development warrants monitoring but the directional impact isn't clear yet.",
    "- Write `summary` in 2–4 sentences max. Write `relevance` in 1–2 sentences. Number-led where possible. No generic hedging.",
    "- List every source you used. Each source object must have title, url, tier, and (when known) date and a short note.",
    "- When a finding clearly maps to one of the thesis checkpoints provided in the user prompt, set thesisCheckpointId to that checkpoint id; otherwise null.",
    "",
    "Also produce:",
    "- positiveDevelopments / negativeDevelopments / neutralOrWatch — the finding ids grouped by impact.",
    "- thesisCheckpointImpact — for each thesis checkpoint, whether it is supported / challenged / no_update, with a 1-sentence note and the finding ids.",
    "- unresolvedQuestions — open questions a human reviewer must investigate manually.",
    "- warnings — surface any limitation (e.g. 'No earnings call transcript publicly available for the latest quarter.').",
  ].join("\n");

  return { system, user: buildResearchUserPrompt(req) };
}

function buildResearchUserPrompt(req: ResearchUpdatesRequest): string {
  const { project, initialMemo, dna, detection, thesisCheckpoints, scope } =
    req;
  const lines: string[] = [];

  lines.push("# 1. Company");
  lines.push(`- Name: ${project.companyName}`);
  if (project.ticker) lines.push(`- Ticker: ${project.ticker}`);
  if (project.sector) lines.push(`- Sector: ${project.sector}`);
  if (detection.detectedCompany && detection.detectedCompany !== project.companyName) {
    lines.push(`- Detected from memo text: ${detection.detectedCompany}`);
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
      `- Memo period is fiscal-label-only (no calendar mapping). Look for developments from the most recent quarter you can attribute to the company, through ${detection.researchCurrent}. Acknowledge this assumption in warnings[].`,
    );
  }
  if (detection.assumptionNotes && detection.assumptionNotes.length > 0) {
    lines.push("- Period assumption notes to acknowledge:");
    for (const note of detection.assumptionNotes) lines.push(`  - ${note}`);
  }

  lines.push("");
  lines.push("# 3. Original memo style summary");
  lines.push(`- Tone adjectives: ${dna.styleTone.adjectives.join(", ") || "—"}`);
  lines.push(`- Analytical framework: ${dna.analyticalFramework.join("; ") || "—"}`);

  lines.push("");
  lines.push("# 4. Original memo text");
  lines.push(`Source: ${initialMemo.sourceFilename}`);
  lines.push("```text");
  lines.push(initialMemo.text);
  lines.push("```");

  const checkpoints = thesisCheckpoints ?? dna.thesisCheckpoints;
  lines.push("");
  lines.push("# 5. Thesis checkpoints to test");
  if (checkpoints.length === 0) {
    lines.push("_No structured checkpoints provided._");
  } else {
    for (const c of checkpoints) {
      lines.push(
        `- ${c.id}: ${c.label} (expected direction: ${c.expectedDirection})`,
      );
      if (c.rationale) lines.push(`  rationale: ${c.rationale}`);
    }
  }

  const scopeLine = scopeSummary(scope);
  if (scopeLine) {
    lines.push("");
    lines.push("# 6. Scope");
    lines.push(scopeLine);
  }

  lines.push("");
  lines.push("# 7. Output requirements");
  lines.push(
    "- Use web_search to find primary sources. Quote URLs verbatim — do not paraphrase them.",
  );
  lines.push(
    "- For every finding, copy the exact URL(s) you cited via web_search into that finding's `sources[]` (title + url + tier). Do not invent URLs.",
  );
  lines.push(
    "- Set `tier` on EVERY source using the 9-priority hierarchy in the system prompt (official / company / exchange / transcript / press / market_data / other).",
  );
  lines.push(
    "- Every finding with impact ≠ neutral must carry at least one source with a working url.",
  );
  lines.push(
    "- Findings whose only verified sources are `press` / `market_data` / `other` should set `impact` to `watch` (not `positive`/`negative`); the server will downgrade otherwise.",
  );
  lines.push(
    "- The server will downgrade unsourced positive/negative/watch findings to neutral and add a warning.",
  );
  lines.push(
    "- Aim for 6–10 findings with the category balance described in the system prompt. Do NOT fabricate to hit a count.",
  );
  lines.push(
    "- Emit a single JSON object matching the schema. No prose outside the JSON.",
  );

  return lines.join("\n");
}

function scopeSummary(
  scope: ResearchUpdatesRequest["scope"],
): string | undefined {
  if (!scope) return undefined;
  if (typeof scope.maxFindings === "number" && scope.maxFindings > 0) {
    return `- Maximum findings to emit: ${scope.maxFindings}.`;
  }
  return undefined;
}

export type { ThesisCheckpoint };
