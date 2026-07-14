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
      id: "sec_exec",
      title: "Executive Update — Top 3 Changes",
      summary: "Sojern integration is the whole story now.",
      body: "Management is guiding to FY27 revenue of Rs 3,100 crore.",
      bullets: ["FIIs added 180bps this quarter."],
      signal: "positive",
      confidence: "high",
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

function render(showBody: boolean): string {
  return renderToString(
    createElement(
      MemoProjectProvider,
      null,
      createElement(MemoReview, {
        memo,
        generationType: "openai" as const,
        showBody,
      }),
    ),
  );
}

describe("MemoReview", () => {
  it("renders the memo body inline when showBody is set", () => {
    const html = render(true);
    expect(html).toContain("Executive Update");
    expect(html).toContain("Sojern integration is the whole story now.");
    expect(html).toContain("FY27 revenue of Rs 3,100 crore");
    expect(html).toContain("FIIs added 180bps");
    // the bridge table
    expect(html).toContain("Read-through");
    expect(html).toContain("Step-change from the Sojern deal");
  });

  it("hides the body and shows the downloads strip when showBody is false", () => {
    const html = render(false);
    expect(html).not.toContain("Step-change from the Sojern deal");
    expect(html).toContain("Download memo PDF");
  });
});
