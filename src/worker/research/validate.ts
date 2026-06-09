import type {
  ResearchFinding,
  ResearchFindings,
  ResearchSource,
} from "@shared/types";
import { normalizeUrl, type HarvestedWebSources } from "../llm/openai";

// Strip nulls on nullable fields so the JSON returned to the route
// mirrors the "absent = undefined" shape used by the rest of the app.
export function normalizeResearchNulls(input: unknown): unknown {
  if (!isPlainObject(input)) return input;
  const copy: Record<string, unknown> = { ...input };
  const findings = copy.findings;
  if (Array.isArray(findings)) {
    copy.findings = findings.map((f) => normalizeFinding(f));
  }
  return copy;
}

function normalizeFinding(input: unknown): unknown {
  if (!isPlainObject(input)) return input;
  const copy: Record<string, unknown> = { ...input };
  if (copy.thesisCheckpointId === null) delete copy.thesisCheckpointId;
  const sources = copy.sources;
  if (Array.isArray(sources)) {
    copy.sources = sources.map((s) => normalizeSource(s));
  }
  return copy;
}

function normalizeSource(input: unknown): unknown {
  if (!isPlainObject(input)) return input;
  const copy: Record<string, unknown> = { ...input };
  if (copy.date === null) delete copy.date;
  if (copy.note === null) delete copy.note;
  return copy;
}

export interface SourceGroundingResult {
  findings: ResearchFindings;
  // True iff the harvested-citation pool is empty OR the model returned no
  // findings. The route turns this into research_no_sources.
  // NOTE: this is NOT keyed on per-finding verification — that would falsely
  // trip whenever the model emitted citations but never copied any URL into
  // a specific finding.
  allEmpty: boolean;
}

// Walk every finding; verify each model-emitted source ONLY by direct
// URL match against the harvested citations (annotations ∪ included
// action.sources). Verified sources are enriched from citation metadata
// when the model omitted title/date. Non-neutral findings with no
// directly-verified source are downgraded to neutral with an "Insufficient
// source coverage." prefix and a warning. Sourceless findings keep
// sources:[] (we deliberately do NOT attach the harvested citation pool
// to individual findings — the model never linked those URLs to that
// finding, and ResearchSource has no field to mark a citation as
// general/context).
export function enforceSourceGrounding(
  raw: ResearchFindings,
  harvested: HarvestedWebSources,
): SourceGroundingResult {
  const warnings: string[] = [...raw.warnings];

  const findings: ResearchFinding[] = raw.findings.map((f) => {
    const sources: ResearchSource[] = f.sources.map((s) => {
      const key = normalizeUrl(s.url);
      const meta = key ? harvested.byUrl.get(key) : undefined;
      return {
        ...s,
        title: s.title || meta?.title || "",
        date: s.date ?? meta?.date,
        verifiedByWebSearch: Boolean(meta),
      };
    });
    const hasVerified = sources.some((s) => s.verifiedByWebSearch);
    const hasAnySource = sources.length > 0;
    if (f.impact !== "neutral" && !hasVerified) {
      warnings.push(
        `Downgraded finding ${f.id}: ${
          hasAnySource
            ? "no web_search-verified source"
            : "no source at all"
        }.`,
      );
      return {
        ...f,
        impact: "neutral",
        relevance: `Insufficient source coverage. ${f.relevance}`,
        sources,
      };
    }
    if (!hasAnySource) {
      warnings.push(
        `Finding ${f.id} emitted with no source — needs manual verification.`,
      );
    }
    return { ...f, sources };
  });

  // Reclassify finding ids across positive / negative / neutralOrWatch
  // based on the (possibly downgraded) impact.
  const findingsById = new Map(findings.map((f) => [f.id, f]));
  const positiveIds = pruneTo(
    raw.positiveDevelopments,
    findingsById,
    (f) => f.impact === "positive",
  );
  const negativeIds = pruneTo(
    raw.negativeDevelopments,
    findingsById,
    (f) => f.impact === "negative",
  );
  const neutralOrWatchIds = Array.from(findingsById.values())
    .filter(
      (f) =>
        f.impact === "neutral" ||
        f.impact === "watch" ||
        (!positiveIds.includes(f.id) && !negativeIds.includes(f.id)),
    )
    .map((f) => f.id)
    // de-dup and preserve insertion order:
    .filter((id, i, arr) => arr.indexOf(id) === i);

  const cleaned: ResearchFindings = {
    ...raw,
    findings,
    positiveDevelopments: positiveIds,
    negativeDevelopments: negativeIds,
    neutralOrWatch: neutralOrWatchIds,
    warnings,
  };

  // Trigger research_no_sources only when there are genuinely zero
  // citations to report (or zero findings). Per-finding verification is
  // handled above (downgrade + warning); it does not gate the whole
  // response, otherwise valid web_search citations that the model failed
  // to copy into a specific finding would surface as a hard failure.
  const allEmpty = findings.length === 0 || harvested.byUrl.size === 0;

  return { findings: cleaned, allEmpty };
}

function pruneTo(
  ids: string[],
  findingsById: Map<string, ResearchFinding>,
  predicate: (f: ResearchFinding) => boolean,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const f = findingsById.get(id);
    if (!f || !predicate(f) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
