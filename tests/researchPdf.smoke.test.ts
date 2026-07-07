import { describe, expect, it } from "vitest";
import type { FullResearchReport } from "@shared/types";
import {
  buildResearchPdf,
  researchFilenameStem,
} from "@/lib/researchPdf";

// The full-research download replaced the on-dashboard long-report list. This
// verifies the PDF builder renders a report with mixed markdown (headings,
// bullets, a table, ₹ figures) and sources into a non-empty PDF blob without
// throwing.

const report: FullResearchReport = {
  company: "RateGain Travel Technologies Ltd",
  ticker: "RATEGAIN",
  periodLabel: "FY26",
  generatedAt: "2026-07-07T10:00:00.000Z",
  sections: [
    {
      id: "stock_valuation",
      title: "Stock Performance & Valuation Evolution",
      markdown: [
        "## Summary",
        "The stock is up **18%** since the memo anchor of ₹670.",
        "",
        "- FIIs added 180bps",
        "- Promoter holding steady",
        "",
        "| Metric | Anchor | Latest |",
        "| --- | --- | --- |",
        "| CMP | ₹670 | ₹792 |",
        "| P/E | 42x | 48x |",
      ].join("\n"),
      sources: [
        { url: "https://www.bseindia.com/x", title: "BSE filing", date: "2026-06-30" },
        { url: "https://screener.in/company/RATEGAIN" },
      ],
      notDisclosed: ["Segment-level EBIT margins"],
    },
    {
      id: "shareholding",
      title: "Shareholding & Ownership Changes",
      markdown: "No material change in the promoter block this quarter.",
      sources: [],
    },
  ],
};

describe("researchPdf", () => {
  it("builds a non-empty PDF blob from a mixed-content report", async () => {
    const blob = await buildResearchPdf(report);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toContain("pdf");
  });

  it("derives a filename stem from ticker + date", () => {
    expect(researchFilenameStem(report)).toBe(
      "rategain-full-research-2026-07-07",
    );
  });
});
