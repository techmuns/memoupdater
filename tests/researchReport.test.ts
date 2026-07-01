import { describe, expect, it } from "vitest";
import { runFullResearchReport } from "@/lib/researchReport";
import { buildReportSectionPrompt, RESEARCH_REPORT_SECTION_IDS } from "../src/worker/research/reportPrompt";
import { coerceReportSection } from "../src/worker/research/reportSchema";
import { RESEARCH_REPORT_SECTION_ORDER } from "@shared/researchReport";
import type {
  ResearchReportSectionRequest,
  ResearchReportSectionResponse,
} from "@shared/types";

const baseReq: Omit<ResearchReportSectionRequest, "section"> = {
  project: { id: "proj_x", companyName: "RateGain Travel", ticker: "RATEGAIN" },
  companyAliases: { longName: "RateGain Travel Technologies", aliases: ["RATEGAIN"] },
  detection: { periodLabel: "FY24", researchCurrent: "2026-06", researchStart: "2024-01" },
  memoContext: "Original thesis: SaaS travel-tech compounder. Target 30x P/E.",
};

describe("buildReportSectionPrompt", () => {
  it("builds a grounded prompt for every section", () => {
    for (const section of RESEARCH_REPORT_SECTION_IDS) {
      const { system, user } = buildReportSectionPrompt({ ...baseReq, section });
      expect(system).toMatch(/primary/i); // source discipline
      expect(user).toContain("RateGain Travel Technologies");
      expect(user).toContain("FY24");
      expect(user.length).toBeGreaterThan(100);
    }
  });

  it("includes memo context for comparison sections and clips it when compact", () => {
    const long = { ...baseReq, memoContext: "X".repeat(20000) };
    const full = buildReportSectionPrompt({ ...long, section: "memo_vs_actual" });
    const compact = buildReportSectionPrompt({ ...long, section: "memo_vs_actual", retryCompact: true });
    expect(full.user).toContain("ORIGINAL MEMO CONTEXT");
    expect(compact.user.length).toBeLessThan(full.user.length);
  });
});

describe("coerceReportSection", () => {
  it("accepts a well-formed section and drops bad sources", () => {
    const out = coerceReportSection({
      markdown: "## Heading\nBody.",
      sources: [{ url: "https://a.com", title: "A", date: "2026-01" }, { title: "no url" }],
      notDisclosed: ["net debt", 42],
    });
    expect(out).not.toBeNull();
    expect(out!.sources).toHaveLength(1);
    expect(out!.notDisclosed).toEqual(["net debt"]);
  });

  it("rejects empty or malformed content", () => {
    expect(coerceReportSection({ markdown: "", sources: [], notDisclosed: [] })).toBeNull();
    expect(coerceReportSection(null)).toBeNull();
    expect(coerceReportSection({ sources: [] })).toBeNull();
  });
});

const ok = (section: string, markdown = "Body"): ResearchReportSectionResponse => ({
  ok: true,
  section: section as ResearchReportSectionResponse extends { section: infer S } ? S : never,
  markdown,
  sources: [{ url: `https://x.com/${section}` }],
  notDisclosed: [],
  findings: [
    {
      id: `${section}_f1`,
      category: "other",
      title: `${section} finding`,
      summary: "A sourced fact with a number: 12%.",
      impact: "neutral",
      relevance: "matters",
      sources: [{ title: "S", url: `https://x.com/${section}` }],
    },
  ],
  unresolvedQuestions: [],
});

function makeArgs(
  apiCall: RunReportArgsCall,
): Parameters<typeof runFullResearchReport>[0] {
  return {
    project: baseReq.project,
    companyAliases: baseReq.companyAliases,
    detection: baseReq.detection,
    apiCall,
    onSectionStart: () => {},
    onSectionDone: () => {},
    onSectionFail: () => {},
    concurrency: 3,
  };
}
type RunReportArgsCall = Parameters<typeof runFullResearchReport>[0]["apiCall"];

describe("runFullResearchReport", () => {
  it("assembles all sections in canonical order", async () => {
    const res = await runFullResearchReport(
      makeArgs(async (req) => ok(req.section)),
    );
    expect(res.outcome).toBe("complete");
    if (res.outcome !== "complete") return;
    expect(res.report.sections.map((s) => s.id)).toEqual([...RESEARCH_REPORT_SECTION_ORDER]);
    expect(res.report.company).toBe("RateGain Travel Technologies");
    // Findings from every section are assembled into ResearchFindings for the memo.
    expect(res.research.findings.length).toBe(RESEARCH_REPORT_SECTION_ORDER.length);
    expect(res.research.findings[0].id).toContain("__");
  });

  it("returns complete_with_warnings when a section fails after retry", async () => {
    const res = await runFullResearchReport(
      makeArgs(async (req) =>
        req.section === "concall"
          ? { ok: false, section: "concall", code: "timeout", message: "slow" }
          : ok(req.section),
      ),
    );
    expect(res.outcome).toBe("complete_with_warnings");
    if (res.outcome !== "complete_with_warnings") return;
    expect(res.failed).toContain("concall");
    expect(res.report.sections.find((s) => s.id === "concall")).toBeUndefined();
  });

  it("retries a transient failure in compact mode then succeeds", async () => {
    const attempts = new Map<string, number>();
    const res = await runFullResearchReport(
      makeArgs(async (req) => {
        const n = (attempts.get(req.section) ?? 0) + 1;
        attempts.set(req.section, n);
        if (req.section === "shareholding" && !req.retryCompact) {
          return { ok: false, section: "shareholding", code: "parse_error", message: "bad json" };
        }
        return ok(req.section);
      }),
    );
    expect(res.outcome).toBe("complete");
    expect(attempts.get("shareholding")).toBe(2); // primary + compact retry
  });

  it("fails when every section fails", async () => {
    const res = await runFullResearchReport(
      makeArgs(async (req) => ({ ok: false, section: req.section, code: "provider_error", message: "down" })),
    );
    expect(res.outcome).toBe("failed");
  });
});
