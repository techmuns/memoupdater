import { describe, expect, it } from "vitest";
import { parseSectionJson } from "../src/worker/llm/parse";

// The new memo format: each core section emits a 3-column `comparison` table.
// This locks in that the worker parser accepts and normalizes it.

describe("parseSectionJson — comparison", () => {
  it("parses a well-formed 3-column comparison table", () => {
    const res = parseSectionJson(
      {
        id: "sec_thesis_scorecard",
        title: "Valuation",
        summary: "Re-rated; return came from the multiple.",
        body: "",
        bullets: [],
        signal: "watch",
        sources: [],
        comparison: [
          {
            originalThesis: "Stock price: Rs 670 on 7 May 2024",
            latest: "Rs 952.25 (2026-07-14)",
            whatChanged: "Re-rated; +42% despite flat PAT",
          },
          {
            originalThesis: "EBITDA margin: ~23% expected",
            latest: "18.5% reported",
            whatChanged: "Missed by ~4.5 pp",
          },
        ],
      },
      "sec_thesis_scorecard",
      new Set<string>(),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.section.comparison).toHaveLength(2);
    expect(res.section.comparison?.[0]).toEqual({
      originalThesis: "Stock price: Rs 670 on 7 May 2024",
      latest: "Rs 952.25 (2026-07-14)",
      whatChanged: "Re-rated; +42% despite flat PAT",
    });
  });

  it("drops fully-empty rows and trims cells", () => {
    const res = parseSectionJson(
      {
        id: "sec_what_changed",
        title: "What Changed",
        summary: "x",
        body: "",
        bullets: [],
        signal: "neutral",
        sources: [],
        comparison: [
          { originalThesis: "  a  ", latest: "", whatChanged: "" },
          { originalThesis: "", latest: "", whatChanged: "" },
        ],
      },
      "sec_what_changed",
      new Set<string>(),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.section.comparison).toEqual([
      { originalThesis: "a", latest: "", whatChanged: "" },
    ]);
  });

  it("leaves comparison undefined when absent (legacy memos)", () => {
    const res = parseSectionJson(
      {
        id: "sec_what_changed",
        title: "What Changed",
        summary: "x",
        body: "prose",
        bullets: [],
        signal: "neutral",
        sources: [],
      },
      "sec_what_changed",
      new Set<string>(),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.section.comparison).toBeUndefined();
  });
});
