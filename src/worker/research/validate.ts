import type {
  ResearchFinding,
  ResearchFindings,
  ResearchSource,
  SourceTier,
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
  if (copy.tier === null) delete copy.tier;
  return copy;
}

// Higher rank = lower-confidence tier. The server only ever DOWNGRADES
// to a higher-rank (less confident) tier — it never upgrades. So a model
// that labels a Reuters URL as "official" gets corrected to "press"; a
// model that labels an SEC URL as "press" stays as "press" (server
// won't second-guess in the safer direction's opposite).
const TIER_RANK: Record<SourceTier, number> = {
  official: 0,
  company: 1,
  exchange: 2,
  transcript: 3,
  press: 4,
  market_data: 5,
  other: 6,
};

const ALL_TIER_VALUES: readonly SourceTier[] = [
  "official",
  "company",
  "exchange",
  "transcript",
  "press",
  "market_data",
  "other",
];

const PRIMARY_TIERS = new Set<SourceTier>([
  "official",
  "company",
  "exchange",
  "transcript",
]);

// Domain/path/title heuristics. Hostnames are matched case-insensitively
// and with subdomain awareness (e.g. "reuters.com" matches
// "www.reuters.com" and "live.reuters.com"). Path patterns let us pick
// "official" inside an exchange host when the path looks like a filing.
interface TierRules {
  // Exact-suffix host matches (subdomain-aware).
  hosts?: readonly string[];
  // Path regexes (lowercased) applied AFTER a host match.
  pathPatterns?: readonly RegExp[];
  // Title regexes (lowercased), independent of host.
  titlePatterns?: readonly RegExp[];
}

const TIER_RULES: Record<SourceTier, TierRules> = {
  official: {
    pathPatterns: [
      /\/filings?\b/,
      /\/annual[-_]?report/,
      /\/audited[-_]?(result|results|financials)/,
      /\/earnings[-_]?release/,
      /\/quarterly[-_]?result/,
    ],
    titlePatterns: [
      /\bannual report\b/,
      /\baudited (results|financials)\b/,
      /\bearnings release\b/,
      /\bquarterly (results|report)\b/,
      /\b10-?[kq]\b/,
      /\b20-?f\b/,
    ],
  },
  company: {
    hosts: ["investors.", "ir."],
    titlePatterns: [
      /\binvestor presentation\b/,
      /\bpress release\b/,
      /\bcorporate update\b/,
    ],
  },
  exchange: {
    hosts: [
      "bseindia.com",
      "nseindia.com",
      "sec.gov",
      "sebi.gov.in",
      "lseg.com",
      "londonstockexchange.com",
      "hkex.com.hk",
      "jpx.co.jp",
      "set.or.th",
      "asx.com.au",
      "tase.co.il",
      "nasdaq.com",
      "nyse.com",
    ],
  },
  transcript: {
    hosts: [
      "seekingalpha.com",
      "fool.com",
      "motleyfool.com",
    ],
    titlePatterns: [
      /\b(earnings|conference) call transcript\b/,
      /\bearnings call\b/,
      /\bcall transcript\b/,
    ],
  },
  press: {
    hosts: [
      "reuters.com",
      "bloomberg.com",
      "ft.com",
      "wsj.com",
      "nytimes.com",
      "cnbc.com",
      "economictimes.indiatimes.com",
      "livemint.com",
      "mint.com",
      "businessstandard.com",
      "business-standard.com",
      "moneycontrol.com",
      "forbes.com",
      "barrons.com",
      "marketwatch.com",
      "thehindubusinessline.com",
      "financialexpress.com",
      "bbc.com",
      "bbc.co.uk",
    ],
  },
  market_data: {
    hosts: [
      "finance.yahoo.com",
      "yahoo.com",
      "google.com",
      "tradingview.com",
      "screener.in",
      "tickertape.in",
      "simplywall.st",
      "stockanalysis.com",
      "wsj.com/market-data",
      "morningstar.com",
    ],
  },
  other: {},
};

function hostMatches(host: string, candidate: string): boolean {
  if (candidate.startsWith(".")) {
    return host.endsWith(candidate);
  }
  if (candidate.endsWith(".")) {
    return host.startsWith(candidate) || host.includes(`.${candidate}`);
  }
  return host === candidate || host.endsWith(`.${candidate}`);
}

function isValidTier(value: unknown): value is SourceTier {
  return (
    typeof value === "string" &&
    (ALL_TIER_VALUES as readonly string[]).includes(value)
  );
}

// Conservative URL/title-based tier inference. Returns the strictest
// (lowest-rank) tier any rule supports for this source; falls back to
// "other" when nothing matches confidently.
export function inferSourceTier(
  rawUrl: string,
  title?: string,
): SourceTier {
  let host = "";
  let path = "";
  try {
    const u = new URL(rawUrl);
    host = u.hostname.toLowerCase();
    path = u.pathname.toLowerCase();
  } catch {
    // Unparseable URL: titles may still help us pick a tier.
  }
  const titleLc = (title ?? "").toLowerCase();

  // We collect all tiers whose rules fire, then pick the strictest.
  const matches: SourceTier[] = [];

  for (const tier of ALL_TIER_VALUES) {
    const rules = TIER_RULES[tier];
    if (rules.hosts && host) {
      for (const h of rules.hosts) {
        if (hostMatches(host, h.toLowerCase())) {
          matches.push(tier);
          break;
        }
      }
    }
    if (
      rules.titlePatterns &&
      titleLc &&
      rules.titlePatterns.some((re) => re.test(titleLc))
    ) {
      matches.push(tier);
    }
  }

  // "official" path-pattern check: only fires AFTER we already know the
  // host is an exchange/regulator. This prevents random /filings/ paths
  // on aggregator sites from masquerading as official.
  if (matches.includes("exchange") && path) {
    const officialPaths = TIER_RULES.official.pathPatterns ?? [];
    if (officialPaths.some((re) => re.test(path))) {
      matches.push("official");
    }
  }

  if (matches.length === 0) return "other";
  return matches.sort((a, b) => TIER_RANK[a] - TIER_RANK[b])[0]!;
}

// Public for tests + research route: given a model-emitted tier and the
// URL/title, return the tier that will be stored on the source.
//
// Two cases:
// 1. Model emitted no valid tier → use the server-inferred tier (no
//    "never upgrade" guard applies because there is no model claim to
//    preserve). Worst case the inference can't classify and we get
//    "other", which is the most cautious value anyway.
// 2. Model emitted a valid tier → server only ever DOWNGRADES (picks
//    the safer / higher-rank / lower-confidence tier between model and
//    inference). A model claim of "official" against a press URL gets
//    corrected to "press"; a model claim of "press" against an SEC URL
//    stays "press" (server never upgrades).
export function reconcileSourceTier(
  modelTier: unknown,
  rawUrl: string,
  title?: string,
): SourceTier {
  const inferred = inferSourceTier(rawUrl, title);
  if (!isValidTier(modelTier)) return inferred;
  return TIER_RANK[inferred] > TIER_RANK[modelTier] ? inferred : modelTier;
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
// when the model omitted title/date. Each source's tier is reconciled
// against URL/title heuristics — the server only ever DOWNGRADES the
// model-emitted tier (never upgrades). Two impact-downgrade rules run:
//   - Non-neutral findings with no directly-verified source → neutral,
//     "Insufficient source coverage." prefix + warning. (Preserved from
//     the prior fix; the strongest no-fabrication guard.)
//   - Non-neutral findings whose verified sources are all `press` /
//     `market_data` / `other` (no primary-tier verified source) →
//     watch, "Insufficient primary-source coverage." prefix + warning.
//     New in Phase 5B; downgrades to `watch` (not `neutral`) so the
//     signal isn't lost entirely.
// Sourceless findings keep sources:[] — we deliberately do NOT attach
// the harvested citation pool to individual findings; the model never
// linked those URLs to that finding.
export function enforceSourceGrounding(
  raw: ResearchFindings,
  harvested: HarvestedWebSources,
): SourceGroundingResult {
  const warnings: string[] = [...raw.warnings];

  const findings: ResearchFinding[] = raw.findings.map((f) => {
    const sources: ResearchSource[] = f.sources.map((s) => {
      const key = normalizeUrl(s.url);
      const meta = key ? harvested.byUrl.get(key) : undefined;
      const tier = reconcileSourceTier(s.tier, s.url, s.title || meta?.title);
      return {
        ...s,
        title: s.title || meta?.title || "",
        date: s.date ?? meta?.date,
        verifiedByWebSearch: Boolean(meta),
        tier,
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
    // Primary-tier cross-finding rule: non-neutral, non-watch findings
    // need at least one source that is BOTH verifiedByWebSearch AND in
    // a primary tier. press/market_data/other-only support isn't enough
    // to carry a positive/negative thesis claim.
    const hasPrimaryVerified = sources.some(
      (s) => s.verifiedByWebSearch && s.tier && PRIMARY_TIERS.has(s.tier),
    );
    if (
      (f.impact === "positive" || f.impact === "negative") &&
      !hasPrimaryVerified
    ) {
      warnings.push(
        `Downgraded finding ${f.id} to watch: no primary-tier verified source.`,
      );
      return {
        ...f,
        impact: "watch",
        relevance: `Insufficient primary-source coverage. ${f.relevance}`,
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
