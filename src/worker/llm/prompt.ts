import type {
  GenerateFollowUpMemoRequest,
  ResearchFinding,
  ResearchFindings,
} from "@shared/types";

const CANONICAL_SECTION_IDS = [
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

const CANONICAL_TITLES: Record<(typeof CANONICAL_SECTION_IDS)[number], string> =
  {
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

export interface BuildPromptResult {
  system: string;
  user: string;
  jsonSchema: object;
}

export function buildPrompt(
  req: GenerateFollowUpMemoRequest,
  jsonSchema: object,
): BuildPromptResult {
  const hasResearch =
    Boolean(req.research) && Array.isArray(req.research?.findings);

  const systemLines = [
    "You are a buy-side / institutional broker-note analyst updating an existing investment thesis. You are NOT a generic AI assistant.",
    "Mirror the original uploaded memo's voice: number-led, thesis-driven, checkpoint-based, concise. Direct investor language. No hedging in every paragraph.",
    "",
    "Length ceilings (HARD limits — exceed them and the output is wrong):",
    "- `summary`: 2–4 lines max.",
    "- `bullets`: 3–5 items max, each one short investor-grade line.",
    "- `body`: short paragraphs only — not multi-paragraph essays.",
    "- Avoid generic AI phrasing (e.g. 'the incremental evidence increases the need to separate operating EPS from other income / fair value effects'). Write like the original memo: 'C&W remains the thesis support, but the quality of growth is less clean because wire destocking and commodity inventory gains are now part of the story.'",
    "",
    "Rules you must follow:",
    "- Cite only material provided in this request — the original memo and the listed research findings.",
    "- Clearly separate where the original memo HELD vs where it BROKE.",
    "- Flag missing data explicitly. Do not invent numbers, dates, or commentary.",
    "- No fake precision. No unsupported claims.",
    "- Cite only documentIds listed in the 'Available document IDs' table below.",
    "- Emit a single JSON object matching the provided schema. Do not include prose outside the JSON.",
    "",
    "Confidence + manual-checks plumbing (NEW — replaces per-section 'Needs manual verification'):",
    "- For EACH section, set `confidence` to `high` / `medium` / `low` based on the strength + tier of supporting sources:",
    "    official / company / exchange / transcript sources → favor `high`.",
    "    press / market_data sources only → `medium`.",
    "    no source at all → `low`.",
    "- Use `confidenceNote` (one short sentence) for the WHY — e.g. 'Official Q4 result found; investor presentation not located.' NOT for the words 'Needs manual verification'.",
    "- HARD: Do NOT write 'Needs manual verification' inside any section body, bullet, summary, or `confidenceNote`. Do NOT repeat the same manual-check phrase across sections.",
    "- If specific checks remain, list them ONCE in the top-level `manualChecksRemaining` array (one short line each). That array is rendered once at the foot of the memo.",
    "",
    "Bridge rows (NEW — for the three quantitative sections):",
    "- For sec_q4_retest, sec_eps_bridge, and sec_valuation_peer_gap, populate `bridge` with rows: { metric, original?, latest?, readThrough? }.",
    "- Only populate `bridge` rows where you have a source-anchored value. Leave a field blank rather than inventing a number.",
    "- Do NOT say 'cannot be fully re-tested' if at least one bridge row is populated.",
    "- sec_q4_retest preferred metrics: revenue growth YoY, EBITDA growth, EBITDA margin, PAT / adjusted PAT, EPS, segment growth, key one-offs / other income, guidance change, consensus beat/miss.",
    "- sec_eps_bridge preferred metrics: prior EPS estimate, latest reported EPS / revised estimate, deltas explained line by line.",
    "- sec_valuation_peer_gap preferred metrics: original valuation anchor (e.g. '50x Dec'27E EPS = INR 1,750'), current trading multiple if available, original target price / upside, current valuation read-through, EPS credibility, whether the original PT/upside case still holds. When current market price isn't reliably source-verified, use 'current price not source-verified in this run' rather than inventing a number.",
    "",
    "Research-to-memo handoff (NEW — weight findings by tier):",
    "- Treat findings backed by official / company / exchange / transcript sources as the SPINE of the memo.",
    "- press / market_data findings are corroborating only — never the sole basis for a non-neutral claim.",
    "- Findings whose only verified source is `tier: other` or which have no `verifiedByWebSearch` source can be used for color at most; they must NOT drive thesis-level conclusions.",
    "",
    "Final action (sec_final_action) MUST follow this template verbatim in `body`, including the closing caveat line:",
    "  Provisional action: ADD / HOLD / WATCH / REDUCE / AVOID",
    "  Confidence: High / Medium / Low",
    "  Why:",
    "  - bullet",
    "  - bullet",
    "  - bullet",
    "  What would change the call:",
    "  - trigger 1",
    "  - trigger 2",
    "  - trigger 3",
    "",
    "  Note: This is a draft for research workflow support, not investment advice; human analyst sign-off required.",
    "",
    "The action label is explicitly PROVISIONAL — never present it as a final recommendation. The investment-advice caveat is required and must appear in the section body exactly as written.",
  ];
  if (!hasResearch) {
    systemLines.push(
      "",
      "No current external research was available for this memo. Do NOT invent recent developments. Set every section's `confidence` to `low`. Add ONE entry to `manualChecksRemaining`: 'External research was not run for this memo; all forward-looking claims need to be verified by a human analyst.' Do NOT write 'Needs manual verification' anywhere else.",
    );
  }
  systemLines.push(
    "",
    "Output must contain exactly 9 sections in canonical order, matching these ids:",
    CANONICAL_SECTION_IDS.map(
      (id, i) => `  ${i + 1}. ${id} — ${CANONICAL_TITLES[id]}`,
    ).join("\n"),
  );

  return {
    system: systemLines.join("\n"),
    user: buildUserPrompt(req),
    jsonSchema,
  };
}

function buildUserPrompt(req: GenerateFollowUpMemoRequest): string {
  const { project, initialMemo, dna, research, detection } = req;
  const lines: string[] = [];

  lines.push("# 1. Project");
  lines.push(`- Ticker: ${project.ticker}`);
  lines.push(`- Company: ${project.companyName}`);
  if (project.sector) lines.push(`- Sector: ${project.sector}`);
  if (detection) {
    lines.push(`- Memo latest period: ${detection.periodLabel}`);
    if (detection.researchStart) {
      lines.push(`- Research window: ${detection.researchStart} → ${detection.researchCurrent}`);
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
  lines.push("# 2. Original memo style summary");
  lines.push(
    `- Tone adjectives: ${dna.styleTone.adjectives.join(", ") || "—"}`,
  );
  lines.push(
    `- Analytical framework: ${dna.analyticalFramework.join("; ") || "—"}`,
  );

  lines.push("");
  lines.push("# 3. Memo DNA (compact JSON)");
  lines.push("```json");
  lines.push(JSON.stringify(dna));
  lines.push("```");

  lines.push("");
  lines.push("# 4. Original memo text");
  lines.push(`Source: ${initialMemo.sourceFilename}`);
  lines.push("```text");
  lines.push(initialMemo.text);
  lines.push("```");

  lines.push("");
  lines.push("# 5. Research findings");
  if (!research || research.findings.length === 0) {
    lines.push(
      "_No external research findings were provided for this memo. Acknowledge this gap once in `manualChecksRemaining`, set every section's `confidence` to `low`, and do NOT invent recent developments. Do NOT write 'Needs manual verification' anywhere in the sections._",
    );
  } else {
    lines.push(
      `Research window: ${research.researchWindow.startIsoMonth} → ${research.researchWindow.endIsoMonth}`,
    );
    lines.push(`Company researched: ${research.company}`);
    lines.push("");
    lines.push(
      "_Each source below carries `tier` (official/company/exchange/transcript = primary; press/market_data/other = corroborating) and `verifiedByWebSearch` (server-confirmed via the web_search citation). Use primary, verified sources as the SPINE of the memo — corroborating sources are color, not load-bearing._",
    );
    lines.push("");
    for (const f of research.findings) {
      lines.push(`## ${f.id} [${f.category}] ${f.title}`);
      lines.push(`Impact: ${f.impact}`);
      lines.push(`Summary: ${f.summary}`);
      lines.push(`Relevance: ${f.relevance}`);
      if (f.sources.length > 0) {
        lines.push("Sources:");
        for (const s of f.sources) {
          const verified = s.verifiedByWebSearch ? " · verified" : "";
          const tier = s.tier ? ` · tier:${s.tier}` : "";
          const date = s.date ? ` · ${s.date}` : "";
          lines.push(`  - ${s.title}${date}${tier}${verified}: ${s.url}`);
        }
      } else {
        lines.push("Sources: (none — finding will only contribute color)");
      }
      lines.push("");
    }
    if (research.thesisCheckpointImpact.length > 0) {
      lines.push("### Thesis checkpoint impact");
      for (const c of research.thesisCheckpointImpact) {
        lines.push(`- ${c.checkpointId} → ${c.impact}: ${c.note}`);
      }
      lines.push("");
    }
    if (research.unresolvedQuestions.length > 0) {
      lines.push("### Unresolved questions");
      for (const q of research.unresolvedQuestions) {
        lines.push(`- ${q}`);
      }
      lines.push("");
    }
    if (research.warnings.length > 0) {
      lines.push("### Research warnings");
      for (const w of research.warnings) {
        lines.push(`- ${w}`);
      }
    }
  }

  lines.push("");
  lines.push("# 6. Available document IDs");
  lines.push("Cite only these documentIds:");
  if (initialMemo.id) {
    lines.push(
      `- ${initialMemo.id} → ${initialMemo.sourceFilename} (initial_memo)`,
    );
  }
  if (research && research.findings.length > 0) {
    for (const f of research.findings) {
      lines.push(`- ${f.id} → research finding (${f.category})`);
    }
  }

  lines.push("");
  lines.push("# 7. Output requirements");
  lines.push(
    "- Exactly 9 sections, in the canonical order and ids from the system prompt.",
  );
  lines.push(
    "- Each section: id, title, summary (2–4 lines max), body (short paragraphs only), bullets (3–5 max), signal (positive|negative|neutral|watch), confidence (high|medium|low), confidenceNote (one short sentence WHY — never 'Needs manual verification'), sources (cite ids from §6 only).",
  );
  lines.push(
    "- For sec_q4_retest, sec_eps_bridge, sec_valuation_peer_gap: populate `bridge` rows with source-anchored values; leave a field blank rather than invent one.",
  );
  lines.push(
    "- For each source, include the documentId (required) plus optional page and quote.",
  );
  lines.push(
    "- 'Where the Original Memo Held' / 'Where the Original Memo Broke' must reflect the actual evidence in §4 and §5, anchored on the checkpoints in §3.",
  );
  lines.push(
    "- 'Final Investment Action' (sec_final_action) MUST follow the provisional template from the system prompt — including the closing 'not investment advice; human analyst sign-off required' caveat — and reflect the overall balance of evidence.",
  );
  lines.push(
    "- If specific checks still need a human, list them ONCE at the top-level `manualChecksRemaining`. Do NOT scatter 'Needs manual verification' across the sections.",
  );
  lines.push(
    "- Emit a single JSON object that matches the schema. Do not include any prose outside the JSON.",
  );

  return lines.join("\n");
}

// Re-export for the research route and trim helpers to share the same
// finding type ergonomics without re-imports.
export type { ResearchFinding, ResearchFindings };
