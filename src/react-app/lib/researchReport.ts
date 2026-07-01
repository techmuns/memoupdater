import type {
  FullResearchReport,
  ResearchErrorCode,
  ResearchFinding,
  ResearchFindings,
  ResearchReportDetectionInput,
  ResearchReportProjectRef,
  ResearchReportSection,
  ResearchReportSectionId,
  ResearchReportSectionRequest,
  ResearchReportSectionResponse,
} from "@shared/types";
import {
  RESEARCH_REPORT_SECTION_ORDER,
  RESEARCH_REPORT_SECTION_TITLES,
} from "@shared/researchReport";

// Client orchestrator for the comprehensive research report. Runs each section
// as its own web-grounded worker call with bounded concurrency, retries once
// in "compact" mode on transient failures, and assembles the successful
// sections (in canonical order) into a FullResearchReport.

const RETRY_COMPACT_CODES = new Set<ResearchErrorCode>([
  "parse_error",
  "timeout",
  "provider_error",
  "rate_limited",
]);

const DEFAULT_CONCURRENCY = 3;

export interface RunReportArgs {
  project: ResearchReportProjectRef;
  companyAliases: { longName: string; aliases?: string[] };
  detection: ResearchReportDetectionInput;
  memoContext?: string;
  apiCall: (
    req: ResearchReportSectionRequest,
    signal?: AbortSignal,
  ) => Promise<ResearchReportSectionResponse>;
  signal?: AbortSignal;
  onSectionStart: (id: ResearchReportSectionId, attempt: 1 | 2) => void;
  onSectionDone: (section: ResearchReportSection) => void;
  onSectionFail: (
    id: ResearchReportSectionId,
    code: ResearchErrorCode,
    message: string,
  ) => void;
  concurrency?: number;
}

export type RunReportResult =
  | {
      outcome: "complete" | "complete_with_warnings";
      report: FullResearchReport;
      // Structured findings assembled from every section — fed to the memo
      // drafter exactly like the old narrowed passes were.
      research: ResearchFindings;
      failed: ResearchReportSectionId[];
    }
  | { outcome: "failed"; code: ResearchErrorCode; message: string; failed: ResearchReportSectionId[] }
  | { outcome: "aborted" };

export async function runFullResearchReport(
  args: RunReportArgs,
): Promise<RunReportResult> {
  const ids = [...RESEARCH_REPORT_SECTION_ORDER];
  const done = new Map<ResearchReportSectionId, ResearchReportSection>();
  const failed: ResearchReportSectionId[] = [];
  const allFindings: ResearchFinding[] = [];
  const allUnresolved: string[] = [];

  const concurrency = Math.max(1, args.concurrency ?? DEFAULT_CONCURRENCY);
  let cursor = 0;
  let aborted = false;

  async function worker(): Promise<void> {
    while (true) {
      if (args.signal?.aborted) {
        aborted = true;
        return;
      }
      const idx = cursor++;
      if (idx >= ids.length) return;
      const id = ids[idx];

      const req: ResearchReportSectionRequest = {
        section: id,
        project: args.project,
        companyAliases: args.companyAliases,
        detection: args.detection,
        memoContext: args.memoContext,
      };

      args.onSectionStart(id, 1);
      let res = await safeCall(args.apiCall, req, args.signal);
      if (res.aborted) {
        aborted = true;
        return;
      }
      if (
        !res.value.ok &&
        RETRY_COMPACT_CODES.has(res.value.code) &&
        !args.signal?.aborted
      ) {
        args.onSectionStart(id, 2);
        res = await safeCall(args.apiCall, { ...req, retryCompact: true }, args.signal);
        if (res.aborted) {
          aborted = true;
          return;
        }
      }

      if (res.value.ok) {
        const section: ResearchReportSection = {
          id,
          title: RESEARCH_REPORT_SECTION_TITLES[id],
          markdown: res.value.markdown,
          sources: res.value.sources,
          notDisclosed:
            res.value.notDisclosed.length > 0 ? res.value.notDisclosed : undefined,
        };
        done.set(id, section);
        // Namespace finding ids by section so ids stay unique across sections.
        for (const f of res.value.findings) {
          allFindings.push({ ...f, id: `${id}__${f.id}` });
        }
        allUnresolved.push(...res.value.unresolvedQuestions);
        args.onSectionDone(section);
      } else {
        failed.push(id);
        args.onSectionFail(id, res.value.code, res.value.message);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, () => worker()),
  );

  if (aborted) return { outcome: "aborted" };

  const sections = ids
    .map((id) => done.get(id))
    .filter((s): s is ResearchReportSection => Boolean(s));

  if (sections.length === 0) {
    return {
      outcome: "failed",
      code: "research_no_sources",
      message: "Every report section failed — no report was produced.",
      failed,
    };
  }

  const generatedAt = new Date().toISOString();
  const report: FullResearchReport = {
    company: args.companyAliases.longName,
    ticker: args.project.ticker,
    periodLabel: args.detection.periodLabel,
    generatedAt,
    sections,
  };

  const research = assembleResearchFindings({
    company: args.companyAliases.longName,
    window: {
      startIsoMonth: args.detection.researchStart ?? "",
      endIsoMonth: args.detection.researchCurrent,
    },
    generatedAt,
    findings: allFindings,
    unresolvedQuestions: allUnresolved,
  });

  return {
    outcome: failed.length > 0 ? "complete_with_warnings" : "complete",
    report,
    research,
    failed,
  };
}

// Build the ResearchFindings the memo drafter consumes from the aggregated
// per-section findings: dedupe by primary source URL, and summarize the
// positive/negative/watch developments from finding impact. thesisCheckpoint
// impact is left empty (the report is memo-agnostic; the memo prompt tolerates
// an empty array).
function assembleResearchFindings(args: {
  company: string;
  window: { startIsoMonth: string; endIsoMonth: string };
  generatedAt: string;
  findings: ResearchFinding[];
  unresolvedQuestions: string[];
}): ResearchFindings {
  const byKey = new Map<string, ResearchFinding>();
  const noKey: ResearchFinding[] = [];
  for (const f of args.findings) {
    const key = f.sources.find((s) => s.url)?.url?.toLowerCase().replace(/\/+$/, "");
    if (!key) {
      noKey.push(f);
      continue;
    }
    if (!byKey.has(key)) byKey.set(key, f);
  }
  const findings = [...byKey.values(), ...noKey];

  const positiveDevelopments: string[] = [];
  const negativeDevelopments: string[] = [];
  const neutralOrWatch: string[] = [];
  for (const f of findings) {
    if (f.impact === "positive") positiveDevelopments.push(f.title);
    else if (f.impact === "negative") negativeDevelopments.push(f.title);
    else neutralOrWatch.push(f.title);
  }

  const unresolvedQuestions = Array.from(new Set(args.unresolvedQuestions)).slice(0, 12);

  return {
    generatedAt: args.generatedAt,
    company: args.company,
    researchWindow: args.window,
    findings,
    positiveDevelopments: positiveDevelopments.slice(0, 12),
    negativeDevelopments: negativeDevelopments.slice(0, 12),
    neutralOrWatch: neutralOrWatch.slice(0, 12),
    thesisCheckpointImpact: [],
    unresolvedQuestions,
    warnings: [],
  };
}

interface SafeCallResult {
  aborted: boolean;
  value: ResearchReportSectionResponse;
}

async function safeCall(
  apiCall: RunReportArgs["apiCall"],
  req: ResearchReportSectionRequest,
  signal: AbortSignal | undefined,
): Promise<SafeCallResult> {
  try {
    const value = await apiCall(req, signal);
    return { aborted: false, value };
  } catch (err) {
    if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
      return {
        aborted: true,
        value: { ok: false, section: req.section, code: "provider_error", message: "aborted" },
      };
    }
    return {
      aborted: false,
      value: {
        ok: false,
        section: req.section,
        code: "provider_error",
        message: err instanceof Error ? err.message : "Report section request failed.",
      },
    };
  }
}
