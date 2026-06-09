import type {
  CanonicalSectionId,
  GenerateMemoSectionRequest,
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

export const CANONICAL_SECTION_TITLES: Record<CanonicalSectionId, string> = {
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

export interface BuildSectionPromptResult {
  system: string;
  user: string;
  allowedDocumentIds: Set<string>;
}

const SHARED_SYSTEM_LINES = [
  "You are a buy-side / institutional broker-note analyst updating ONE section of an existing investment thesis.",
  "Mirror the original uploaded memo's voice: number-led, thesis-driven, checkpoint-based, concise. Direct investor language. No hedging in every paragraph.",
  "",
  "Length ceilings (HARD limits):",
  "- `summary`: 2–4 lines max.",
  "- `bullets`: 3–5 short investor-grade lines.",
  "- `body`: short paragraphs only — not multi-paragraph essays.",
  "- Avoid generic AI phrasing. Write like the original memo: direct, specific, source-anchored.",
  "",
  "Rules you must follow:",
  "- Cite only material provided in this request (original memo + listed research findings).",
  "- Flag missing data explicitly. Do not invent numbers, dates, or commentary. No fake precision.",
  "- Cite only documentIds listed in the 'Available document IDs' table.",
  "- Emit a SINGLE JSON object matching the schema — one MemoSection. No prose outside the JSON.",
  "- `id` MUST equal the section id requested. Do NOT emit any other section id.",
  "",
  "Confidence calibration:",
  "- official / company / exchange / transcript sources → favor `high`.",
  "- press / market_data sources only → `medium`.",
  "- no source at all → `low`.",
  "- Use `confidenceNote` (one short sentence) for the WHY. Never the words 'Needs manual verification'.",
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
  "- In prose, refer to evidence with human labels: 'the Q4 filing', 'the exchange filing', 'the earnings call', 'the investor presentation', 'press reports', 'market data'. Never 'finding r01 shows...'.",
  "- NEVER use process/meta language in section fields. Banned phrases: 'not directly retrieved', 'this pass', 'source constraints', 'manual verification needed', 'provided materials', 'research workflow', 'AI', 'tool results', 'screeners say'. Data caveats belong in the workflow's manual-checks list (appended separately) — not in sections.",
  "- `confidenceNote` = one evidence-based sentence (what supports the confidence level), with no process language.",
  "- Voice: direct, investor-focused, number-led, concise. A buy-side reader should not be able to tell this section came from an automated workflow.",
];

const SECTION_BLOCKS: Record<CanonicalSectionId, string> = {
  sec_thesis_snapshot: [
    "This is the 'Original Thesis Snapshot' section.",
    "Required content:",
    "- Frame the ORIGINAL thesis as of the memo's latest period (use the Memo latest period from the request).",
    "- 3–5 short bullets covering: thesis statement, key assumptions, valuation anchor, primary risks.",
    "- Body: a brief paragraph that restates the bull case in the original memo's voice.",
    "- This section is DNA-derived only. No research findings are passed for it.",
    "- Confidence: set to `high` if DNA is rich, `medium` otherwise. Sources: cite the initial memo documentId.",
    "- `bridge`: omit (no quantitative re-test here).",
  ].join("\n"),
  sec_q4_retest: [
    "This is the 'Latest Financial Re-test' section.",
    "Required content:",
    "- Re-test the original financial framework against the latest reported data using the financials/guidance findings below.",
    "- `body`: ONE short paragraph (3 sentences max). No markdown tables. No multi-paragraph essays.",
    "- `bullets`: 3 short investor-grade lines max — concrete YoY / QoQ deltas where sources provide them.",
    "- `bridge`: REQUIRED when at least one financials/guidance finding has source-anchored numbers. Produce 3–4 rows MAXIMUM (never more than 4).",
    "  Preferred metrics in order: revenue YoY, EBITDA margin, PAT / adjusted PAT, EPS.",
    "  - Keep each cell SHORT (≤ 80 chars). Numbers + units only (e.g. '16% YoY', '11.4%', 'INR 1,245').",
    "  - LEAVE A CELL BLANK (use null) rather than write an explanatory paragraph into it.",
    "  - Skip currency symbols when a plain code works (use 'INR' not '₹'; use 'USD' not '$'). This avoids JSON-escaping pitfalls.",
    "- `sources`: 3 maximum. Cite the highest-tier finding ids.",
    "- `confidenceNote`: ONE short sentence, ≤ 180 chars.",
    "- If no financials/guidance findings are provided, return a 2-sentence body, set `confidence: low`, omit `bridge`, and stop.",
  ].join("\n"),
  sec_mgmt_retest: [
    "This is the 'Management Commentary Re-test' section.",
    "Required content:",
    "- Re-test management's prior guidance/commentary against the latest management/filings/broker_consensus findings.",
    "- Highlight: tone change, kept commitments, missed commitments, capital-allocation moves, M&A integration.",
    "- Cite transcript / filing / press sources by documentId.",
    "- `bridge`: omit (qualitative section).",
  ].join("\n"),
  sec_ai_macro_risk: [
    "This is the 'AI / Macro / Competitive Risk Check' section.",
    "Required content:",
    "- Re-test AI/tech-risk, macro, and peer-competitive risks using the ai_tech_risk/macro/peers findings.",
    "- If no findings in these categories were provided, say so in TWO sentences and stop. Do NOT invent risks.",
    "- `bridge`: omit.",
  ].join("\n"),
  sec_memo_held: [
    "This is the 'Where the Original Memo Held' section.",
    "Required content:",
    "- Identify checkpoints/assumptions from the original memo that the latest research VALIDATED.",
    "- Use findings flagged in `positiveDevelopmentIds` and watch findings tied to checkpoints with impact=`supported`.",
    "- 3–4 short bullets. Cite evidence via `sources[]` only — in prose use human source labels ('the Q4 filing', 'the earnings call'), never machine ids.",
    "- `bridge`: omit. `signal`: typically `positive` or `neutral`.",
  ].join("\n"),
  sec_memo_broke: [
    "This is the 'Where the Original Memo Broke' section.",
    "Purpose: identify where the original memo is now LESS CLEAN — not only where it outright broke. Partial challenges count.",
    "Required content:",
    "- Use negative findings AND watch findings tied to challenged checkpoints. A watch finding that weakens evidence quality belongs here as 'partially challenged'.",
    "- Distinguish explicitly between four states where evidence supports them:",
    "  (a) thesis pillar still intact,",
    "  (b) quality of evidence weaker (e.g. profit growth supported by fair-value / other income rather than operations),",
    "  (c) valuation support less clean (de-rating vs the original multiple anchor),",
    "  (d) execution / rating risk higher.",
    "- NEVER claim there is 'no evidence the thesis broke' when negative findings or challenged-checkpoint watch findings are present — describe precisely what weakened instead.",
    "- Do not overstate: 'partially challenged' or 'less clean' is the right frame when nothing has outright broken.",
    "- If genuinely nothing weakened, say so in two sentences max.",
    "- `body`: max 2 short paragraphs. `bullets`: 3–4, each naming the specific pressure point (margin compression, profit quality, de-rating, demand risk) with numbers where sourced.",
    "- Cite evidence via `sources[]` only — human labels in prose, never machine ids.",
    "- `bridge`: omit. `signal`: `negative` when a pillar broke; `watch` when partially challenged.",
  ].join("\n"),
  sec_eps_bridge: [
    "This is the 'EPS Credibility Bridge' section.",
    "Required content:",
    "- Bridge the original EPS estimate to the latest reported / revised EPS.",
    "- Use financials/guidance/valuation findings and any watch findings that touch earnings quality.",
    "- `bridge`: REQUIRED when at least one finding has source-anchored EPS / earnings numbers. Max 4–5 rows.",
    "  Preferred metrics: prior EPS estimate, latest reported EPS, latest revised estimate, key delta drivers (margin, mix, one-offs, tax, other income).",
    "- `body`: max 2 short paragraphs — explain the key delta lines. Cite evidence via `sources[]` only; human labels in prose ('the Q4 filing'), never machine ids.",
    "- `bullets`: 3–4 max.",
    "- If no relevant findings exist, say so in 2 sentences, set `confidence: low`, omit `bridge`, and stop.",
  ].join("\n"),
  sec_valuation_peer_gap: [
    "This is the 'Valuation and Peer Gap' section.",
    "Required content:",
    "- Re-test the original valuation anchor (e.g. '50x Dec'27E EPS = INR 1,750') vs the latest valuation and peer set.",
    "- Use valuation/peers findings and watch findings related to valuation.",
    "- `bridge`: REQUIRED when valuation findings exist. Max 4–5 rows.",
    "  Preferred metrics: original valuation anchor, current trading multiple, original target price / upside, current valuation read-through, peer multiple gap, whether the original PT/upside case still holds.",
    "  When the current market price isn't verified from a primary source, write 'current price not verified from a primary source' rather than inventing a number.",
    "- `body`: max 2 short paragraphs. `bullets`: 3–4 max. Cite evidence via `sources[]` only; human labels in prose, never machine ids.",
    "- If no valuation/peers findings exist, say so in 2 sentences, set `confidence: low`, omit `bridge`, and stop.",
  ].join("\n"),
  sec_final_action: [
    "This is the 'Final Investment Action' section. This is the synthesis section.",
    "You will be given a digest of the prior section conclusions (Where the memo Held, Where it Broke, EPS Bridge, Valuation Peer Gap). Use that digest to drive the final call — do NOT re-derive from raw findings.",
    "",
    "The `body` MUST follow this structure:",
    "  Provisional action: ADD / HOLD / WATCH / REDUCE / AVOID",
    "",
    "  Why:",
    "  - 3 bullets max — number-led, evidence-based, drawn from the prior-section digest (thesis support, profit quality, valuation reset)",
    "",
    "  What would change the call:",
    "  - Positive: <2–4 concrete triggers, comma-separated>",
    "  - Negative: <2–4 concrete triggers, comma-separated>",
    "",
    "  Analyst sign-off required:",
    "  - confirm audited numbers, segment margins, and source filings before client use",
    "",
    "  Note: Draft for research support — not investment advice.",
    "",
    "The action label is explicitly PROVISIONAL — never present it as a final recommendation. The closing caveat line is REQUIRED, exactly as written, as the final line of the body.",
    "`bridge`: omit.",
    "`bullets`: 3–4 short triggers (mirror the 'What would change the call' lines).",
    "No machine ids anywhere in the body or bullets.",
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
      "Compact retry: produce tighter prose. Trim bullets to 3 max, body to one short paragraph, sources to the most important 2–3.",
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
    sectionId === "sec_final_action" &&
    priorSectionsDigest &&
    priorSectionsDigest.length > 0
  ) {
    lines.push("");
    lines.push("# 5b. Prior section conclusions");
    lines.push(
      "Use these to compute the Provisional action / Confidence / Why bullets / What would change the call.",
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
