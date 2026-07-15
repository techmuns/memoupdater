import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoReview } from "@/components/MemoReview";
import { MemoProjectProvider } from "@/state/MemoProjectContext";
import type { FollowUpMemo } from "@shared/types";

// #2: the follow-up memo now renders inline on the dashboard (showBody). This
// verifies the section title, summary, body, bridge, and a bullet all appear
// in the rendered HTML — so the memo is actually readable on the page, not
// only in the PDF. MemoReview reads context (PrioritiesAnswerCard), so it's
// wrapped in the provider (SSR runs no effects).

const memo: FollowUpMemo = {
  projectId: "p1",
  title: "Follow-up Memo — RateGain Travel Technologies Ltd",
  generatedAt: "2026-07-13T11:00:00.000Z",
  isDemo: false,
  sections: [
    {
      id: "sec_thesis_scorecard",
      title: "Valuation",
      summary: "Stock re-rated; the return came from the multiple, not EPS.",
      body: "",
      bullets: [],
      signal: "watch",
      sources: [],
      comparison: [
        {
          originalThesis: "Stock price: Rs 670 on 7 May 2024",
          latest: "Rs 952.25 (as of 2026-07-14)",
          whatChanged: "Re-rated; +42% return despite flat PAT",
        },
        {
          originalThesis: "EBITDA margin: ~23% expected FY26",
          latest: "18.5% reported FY26",
          whatChanged: "Missed the memo ask by ~4.5 pp",
        },
      ],
    },
  ],
};

// A legacy saved memo (no comparison) must still render via the prose/bridge
// fallback.
const legacyMemo: FollowUpMemo = {
  ...memo,
  sections: [
    {
      id: "sec_what_changed",
      title: "What Changed",
      summary: "Legacy section.",
      body: "Management is guiding to FY27 revenue of Rs 3,100 crore.",
      bullets: ["FIIs added 180bps this quarter."],
      signal: "positive",
      sources: [],
      bridge: [
        {
          metric: "Revenue",
          original: "Rs 1,823.6 crore",
          latest: "Rs 3,100 crore (guide)",
          readThrough: "Step-change from the Sojern deal",
        },
      ],
    },
  ],
};

function render(m: FollowUpMemo, showBody: boolean): string {
  return renderToString(
    createElement(
      MemoProjectProvider,
      null,
      createElement(MemoReview, {
        memo: m,
        generationType: "openai" as const,
        showBody,
      }),
    ),
  );
}

describe("MemoReview", () => {
  it("renders each section as the 3-column comparison table", () => {
    const html = render(memo, true);
    expect(html).toContain("Valuation");
    // the three fixed column headers
    expect(html).toContain("Original thesis");
    expect(html).toContain("New / latest");
    expect(html).toContain("What changed");
    // cell content across the three columns
    expect(html).toContain("Stock price: Rs 670 on 7 May 2024");
    expect(html).toContain("Rs 952.25 (as of 2026-07-14)");
    expect(html).toContain("Missed the memo ask by ~4.5 pp");
  });

  it("falls back to prose/bridge for legacy memos with no comparison", () => {
    const html = render(legacyMemo, true);
    expect(html).toContain("Read-through");
    expect(html).toContain("Step-change from the Sojern deal");
    expect(html).toContain("FIIs added 180bps");
  });

  it("hides the body and shows the downloads strip when showBody is false", () => {
    const html = render(memo, false);
    expect(html).not.toContain("Stock price: Rs 670 on 7 May 2024");
    expect(html).toContain("Download memo PDF");
  });
});
