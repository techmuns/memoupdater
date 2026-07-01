import type {
  FullResearchReport,
  ResearchErrorCode,
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

  const report: FullResearchReport = {
    company: args.companyAliases.longName,
    ticker: args.project.ticker,
    periodLabel: args.detection.periodLabel,
    generatedAt: new Date().toISOString(),
    sections,
  };

  return {
    outcome: failed.length > 0 ? "complete_with_warnings" : "complete",
    report,
    failed,
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
